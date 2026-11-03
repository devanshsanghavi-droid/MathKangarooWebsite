import 'server-only';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import bundle from './content.bundle.json';
import {
  SkillSchema,
  ProblemSchema,
  PaperIndexSchema,
  STRANDS,
  BANDS,
  POINT_VALUES,
  type Skill,
  type Problem,
  type PaperIndex,
  type Strand,
  type Band,
  type Points,
  type Tier,
} from './schemas';

/**
 * The content layer.
 *
 * Content lives in git and never changes at runtime, so everything here is synchronous and
 * computed once. `buildContentIndex` is a pure function of a directory - give it a fixture
 * tree and it builds an index of that tree - and `contentIndex()` memoises the one built from
 * the repo's own `content/`. Pages call the small accessors at the bottom.
 *
 * Ordering is deterministic everywhere (id, then a stated tiebreak) so that a rebuild produces
 * byte-identical pages and a diff means something changed.
 *
 * Anything invalid throws at build time. `pnpm validate:content` is the friendly error
 * message; this is the backstop that stops a broken file reaching a reader.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface PrerequisiteGraph {
  /** skill id -> the skills it needs first. */
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** skill id -> the skills that need it. Derived, and equal to the reverse of the above. */
  unlocks: ReadonlyMap<string, readonly string[]>;
  /** Skills with no prerequisites, sorted. */
  roots: readonly string[];
  /** Longest path from any root to this skill, counted in edges. Roots are depth 0. */
  depth: ReadonlyMap<string, number>;
}

export interface StrandSummary {
  strand: Strand;
  name: string;
  blurb: string;
  skillCount: number;
  problemCount: number;
  tiers: Record<Tier, number>;
}

export interface ContentStats {
  skills: number;
  problems: number;
  papers: number;
  /** Every incorrect choice carries one, so this counts the explanations we have written. */
  misconceptions: number;
  figures: number;
  skillsWithProblems: number;
  problemsByBand: ReadonlyMap<Band, number>;
  problemsByPoints: ReadonlyMap<Points, number>;
}

export interface ContentIndex {
  skills: readonly Skill[];
  problems: readonly Problem[];
  papers: readonly PaperIndex[];
  skillById: ReadonlyMap<string, Skill>;
  problemById: ReadonlyMap<string, Problem>;
  paperByKey: ReadonlyMap<string, PaperIndex>;
  /** Every problem that tags the skill, primary or secondary, sorted by points then id. */
  problemsBySkill: ReadonlyMap<string, readonly Problem[]>;
  /** Only problems whose PRIMARY skill is this one. */
  primaryProblemsBySkill: ReadonlyMap<string, readonly Problem[]>;
  skillsByStrand: ReadonlyMap<Strand, readonly Skill[]>;
  skillsByBand: ReadonlyMap<Band, readonly Skill[]>;
  problemsByBand: ReadonlyMap<Band, readonly Problem[]>;
  papersBySkill: ReadonlyMap<string, readonly PaperReference[]>;
  graph: PrerequisiteGraph;
  strands: readonly StrandSummary[];
  stats: ContentStats;
}

/** One appearance of a skill in an official paper, as recorded by our own analysis. */
export interface PaperReference {
  year: number;
  band: Band;
  questionNumber: number;
  points: Points;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Strand metadata - the only prose in this file                               */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Re-exported so a page can import metadata and content from one place.       */
/* The definitions live in taxonomy-meta.ts because client components need     */
/* them and this module is server-only.                                        */
/* -------------------------------------------------------------------------- */

export { STRAND_META, TIER_META, TIER_ORDER } from './taxonomy-meta';
import { STRAND_META, TIER_ORDER } from './taxonomy-meta';

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function parseFile<T>(
  file: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success || !parsed.data) {
    throw new Error(
      `${file} does not match its schema. Run \`pnpm validate:content\` for the full report.`,
    );
  }
  return parsed.data;
}

/* -------------------------------------------------------------------------- */
/* Sorting - stated once so every index agrees                                 */
/* -------------------------------------------------------------------------- */

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

/** Practice ladders read 3 → 4 → 5, and within a tier by id, so the order never wobbles. */
const byPointsThenId = (a: Problem, b: Problem) => a.points - b.points || a.id.localeCompare(b.id);

/** Strand pages read foundation → core → gateway, then by id. */
const byTierThenId = (a: Skill, b: Skill) =>
  TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.id.localeCompare(b.id);

/** Papers list newest first, then by band. */
const byYearThenBand = (a: PaperIndex, b: PaperIndex) =>
  b.year - a.year || BANDS.indexOf(a.band) - BANDS.indexOf(b.band);

export const paperKey = (year: number, band: Band | string): string => `${year}-${band}`;

/* -------------------------------------------------------------------------- */
/* Graph                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Longest-path depth from a root, computed by relaxing in topological order. Longest rather
 * than shortest because the Atlas draws a skill below every one of its prerequisites - with
 * shortest paths an edge could point upward and the layout would cross itself.
 *
 * The graph is proven acyclic by `pnpm validate:content` and by the taxonomy test, so a node
 * that never becomes ready would be a bug elsewhere; it is still handled rather than looping.
 */
function computeDepths(prerequisites: ReadonlyMap<string, readonly string[]>): Map<string, number> {
  const depth = new Map<string, number>();
  const remaining = new Set(prerequisites.keys());

  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const id of [...remaining].sort()) {
      const prereqs = prerequisites.get(id) ?? [];
      const known = prereqs.filter((p) => prerequisites.has(p));
      if (!known.every((p) => depth.has(p))) continue;
      const value = known.length === 0 ? 0 : Math.max(...known.map((p) => depth.get(p) ?? 0)) + 1;
      depth.set(id, value);
      remaining.delete(id);
      progressed = true;
    }
  }
  // Only reachable if the graph has a cycle, which CI forbids. Place survivors at the bottom
  // rather than dropping them, so the Atlas still shows every skill.
  for (const id of remaining) depth.set(id, 0);
  return depth;
}

function buildGraph(skills: readonly Skill[]): PrerequisiteGraph {
  const prerequisites = new Map<string, readonly string[]>();
  const unlocks = new Map<string, string[]>();
  for (const skill of skills) {
    prerequisites.set(skill.id, [...skill.prerequisites].sort());
    unlocks.set(skill.id, []);
  }
  for (const skill of skills) {
    for (const prereq of skill.prerequisites) {
      unlocks.get(prereq)?.push(skill.id);
    }
  }
  for (const list of unlocks.values()) list.sort();

  return {
    prerequisites,
    unlocks: new Map([...unlocks].map(([k, v]) => [k, v as readonly string[]])),
    roots: skills
      .filter((s) => s.prerequisites.length === 0)
      .map((s) => s.id)
      .sort(),
    depth: computeDepths(prerequisites),
  };
}

/* -------------------------------------------------------------------------- */
/* The index                                                                   */
/* -------------------------------------------------------------------------- */

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * Build a complete index of a content directory. Pure: same directory in, same index out.
 * Exported so tests can point it at a fixture tree instead of the repo's own content.
 */
export function buildContentIndex(contentDir: string): ContentIndex {
  return indexRecords({
    skills: listJsonFiles(join(contentDir, 'skills')).map((f) => parseFile<Skill>(f, SkillSchema)),
    problems: listJsonFiles(join(contentDir, 'problems')).map((f) =>
      parseFile<Problem>(f, ProblemSchema),
    ),
    papers: listJsonFiles(join(contentDir, 'papers')).map((f) =>
      parseFile<PaperIndex>(f, PaperIndexSchema),
    ),
  });
}

/**
 * Build every derived index from records that are already parsed and validated.
 *
 * Split out from `buildContentIndex` so the same derivation runs over two sources: the
 * filesystem in development, in tests and during the build, and the bundled JSON at runtime
 * on Cloudflare Workers, where there is no filesystem to read. One code path, two front doors
 * - the alternative was a second implementation that could silently disagree with this one.
 */
export function indexRecords(records: {
  skills: readonly Skill[];
  problems: readonly Problem[];
  papers: readonly PaperIndex[];
}): ContentIndex {
  const skills = [...records.skills].sort(byId);
  const problems = [...records.problems].sort(byId);
  const papers = [...records.papers].sort(byYearThenBand);

  const skillById = new Map(skills.map((s) => [s.id, s]));
  const problemById = new Map(problems.map((p) => [p.id, p]));
  const paperByKey = new Map(papers.map((p) => [paperKey(p.year, p.band), p]));

  const problemsBySkill = new Map<string, Problem[]>();
  const primaryProblemsBySkill = new Map<string, Problem[]>();
  for (const skill of skills) {
    problemsBySkill.set(skill.id, []);
    primaryProblemsBySkill.set(skill.id, []);
  }
  for (const problem of problems) {
    // A problem appears in the ladder of every skill it teaches, primary or secondary - a
    // student practising CNT-04 should meet the casework inside a geometry problem too.
    const tagged = new Set([problem.skills.primary, ...problem.skills.secondary]);
    for (const skillId of tagged) {
      if (!skillById.has(skillId)) continue;
      pushInto(problemsBySkill, skillId, problem);
    }
    if (skillById.has(problem.skills.primary)) {
      pushInto(primaryProblemsBySkill, problem.skills.primary, problem);
    }
  }
  for (const list of problemsBySkill.values()) list.sort(byPointsThenId);
  for (const list of primaryProblemsBySkill.values()) list.sort(byPointsThenId);

  const skillsByStrand = new Map<Strand, Skill[]>(STRANDS.map((s) => [s, []]));
  for (const skill of skills) skillsByStrand.get(skill.strand)?.push(skill);
  for (const list of skillsByStrand.values()) list.sort(byTierThenId);

  const skillsByBand = new Map<Band, Skill[]>(BANDS.map((b) => [b, []]));
  for (const skill of skills) {
    for (const band of skill.bands) skillsByBand.get(band)?.push(skill);
  }
  for (const list of skillsByBand.values()) list.sort(byTierThenId);

  const problemsByBand = new Map<Band, Problem[]>(BANDS.map((b) => [b, []]));
  for (const problem of problems) problemsByBand.get(problem.band)?.push(problem);
  for (const list of problemsByBand.values()) list.sort(byPointsThenId);

  const papersBySkill = new Map<string, PaperReference[]>();
  for (const skill of skills) papersBySkill.set(skill.id, []);
  for (const paper of papers) {
    for (const question of paper.questions) {
      for (const skillId of question.skills) {
        if (!skillById.has(skillId)) continue;
        pushInto(papersBySkill, skillId, {
          year: paper.year,
          band: paper.band,
          questionNumber: question.number,
          points: question.points,
          ...(question.note === undefined ? {} : { note: question.note }),
        });
      }
    }
  }
  for (const list of papersBySkill.values()) {
    list.sort((a, b) => b.year - a.year || a.questionNumber - b.questionNumber);
  }

  const strands: StrandSummary[] = STRANDS.map((strand) => {
    const strandSkills = skillsByStrand.get(strand) ?? [];
    const tiers: Record<Tier, number> = { foundation: 0, core: 0, gateway: 0 };
    for (const skill of strandSkills) tiers[skill.tier] += 1;
    return {
      strand,
      name: STRAND_META[strand].name,
      blurb: STRAND_META[strand].blurb,
      skillCount: strandSkills.length,
      problemCount: problems.filter((p) => p.skills.primary.startsWith(strand)).length,
      tiers,
    };
  });

  const problemsByBandCount = new Map<Band, number>(
    BANDS.map((b) => [b, problemsByBand.get(b)?.length ?? 0]),
  );
  const problemsByPoints = new Map<Points, number>(
    POINT_VALUES.map((p) => [p, problems.filter((problem) => problem.points === p).length]),
  );

  const stats: ContentStats = {
    skills: skills.length,
    problems: problems.length,
    papers: papers.length,
    misconceptions: problems.reduce(
      (total, problem) =>
        total + problem.choices.filter((c) => !c.correct && c.misconception).length,
      0,
    ),
    figures: problems.filter((p) => p.figure !== null).length,
    skillsWithProblems: [...problemsBySkill.values()].filter((list) => list.length > 0).length,
    problemsByBand: problemsByBandCount,
    problemsByPoints,
  };

  return {
    skills,
    problems,
    papers,
    skillById,
    problemById,
    paperByKey,
    problemsBySkill,
    primaryProblemsBySkill,
    skillsByStrand,
    skillsByBand,
    problemsByBand,
    papersBySkill,
    graph: buildGraph(skills),
    strands,
    stats,
  };
}

/* -------------------------------------------------------------------------- */
/* The memoised default index, plus the accessors pages use                    */
/* -------------------------------------------------------------------------- */

let cached: ContentIndex | null = null;

/**
 * The index of this repo's `content/`. Built once per process.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS READS A BUNDLED JSON AND NOT THE FILESYSTEM
 *
 * It used to be `buildContentIndex(join(process.cwd(), 'content'))`. That is correct in dev,
 * in tests and during `next build` - and completely wrong on Cloudflare Workers, where
 * `process.cwd()` is `/bundle` and there is no content directory at any path. The prerendered
 * pages never noticed, because their HTML was baked at build time. The three routes that
 * render per-request because they read searchParams - /problems, /atlas, /print - quietly
 * built an EMPTY index and served a site with no problems and no skills, answering HTTP 200
 * the entire time. A route check that looks at status codes cannot see this.
 *
 * `content.bundle.json` is generated by scripts/bundle-content.ts and committed, so the
 * bundler traces it into the worker.
 *
 * IT IS NOT RE-VALIDATED HERE, and that is deliberate. The first version ran every record
 * back through its Zod schema on the way in. That cost 8.8ms of pure CPU on a fast laptop -
 * against a 10ms per-request CPU budget on the Workers free tier, before a single byte of the
 * page had been rendered. Cold isolates blew the limit and Cloudflare answered 503, on a
 * different handful of pages each time depending on which isolate happened to be cold.
 *
 * Nothing is lost by trusting it. `pnpm validate:content` validates every source file against
 * the same schemas, and `pnpm check:bundle` proves byte-for-byte that the bundle still matches
 * content/. Both run in CI, so an invalid bundle cannot reach a deploy. Re-checking at request
 * time paid for a guarantee that was already bought at build time.
 */
export function contentIndex(): ContentIndex {
  cached ??= indexRecords(readBundle());
  return cached;
}

/**
 * Read the bundle with a cheap structural check instead of a full schema parse.
 *
 * This catches the failure that would otherwise be silent - a bundle that is missing, empty or
 * the wrong shape - without walking 268 documents field by field. It costs microseconds.
 */
function readBundle(): {
  skills: readonly Skill[];
  problems: readonly Problem[];
  papers: readonly PaperIndex[];
} {
  const { skills, problems, papers } = bundle as unknown as {
    skills: Skill[];
    problems: Problem[];
    papers: PaperIndex[];
  };
  if (!Array.isArray(skills) || !Array.isArray(problems) || !Array.isArray(papers)) {
    throw new Error('content.bundle.json is malformed. Run: pnpm bundle:content');
  }
  if (skills.length === 0 || problems.length === 0) {
    throw new Error('content.bundle.json is empty. Run: pnpm bundle:content');
  }
  return { skills, problems, papers };
}

/** Exported for tests, which rebuild the index after stubbing content. */
export function resetContentIndex(): void {
  cached = null;
}

export const getAllSkills = (): readonly Skill[] => contentIndex().skills;
export const getSkill = (id: string): Skill | undefined => contentIndex().skillById.get(id);
export const getAllProblems = (): readonly Problem[] => contentIndex().problems;
export const getProblem = (id: string): Problem | undefined => contentIndex().problemById.get(id);
export const getAllPapers = (): readonly PaperIndex[] => contentIndex().papers;
export const getPaper = (year: number, band: string): PaperIndex | undefined =>
  contentIndex().paperByKey.get(paperKey(year, band));

export const getSkillsByStrand = (strand: Strand): readonly Skill[] =>
  contentIndex().skillsByStrand.get(strand) ?? [];
export const getSkillsByBand = (band: Band): readonly Skill[] =>
  contentIndex().skillsByBand.get(band) ?? [];
export const getProblemsForSkill = (skillId: string): readonly Problem[] =>
  contentIndex().problemsBySkill.get(skillId) ?? [];
export const getPrimaryProblemsForSkill = (skillId: string): readonly Problem[] =>
  contentIndex().primaryProblemsBySkill.get(skillId) ?? [];
export const getProblemsByBand = (band: Band): readonly Problem[] =>
  contentIndex().problemsByBand.get(band) ?? [];
export const getPapersForSkill = (skillId: string): readonly PaperReference[] =>
  contentIndex().papersBySkill.get(skillId) ?? [];
export const getGraph = (): PrerequisiteGraph => contentIndex().graph;
export const getStrandSummaries = (): readonly StrandSummary[] => contentIndex().strands;
export const getContentStats = (): ContentStats => contentIndex().stats;

/** The skills a problem teaches, resolved to skill objects; unknown ids are dropped. */
export function getSkillsForProblem(problem: Problem): { primary?: Skill; secondary: Skill[] } {
  const index = contentIndex();
  const primary = index.skillById.get(problem.skills.primary);
  const secondary = problem.skills.secondary
    .map((id) => index.skillById.get(id))
    .filter((s): s is Skill => s !== undefined);
  return { ...(primary ? { primary } : {}), secondary };
}

/**
 * Previous and next problem within the same primary skill, in ladder order. Used by
 * `/problem/[id]`, where "next problem in this skill" has to mean the same thing every time.
 */
export function getAdjacentInSkill(problemId: string): {
  previous?: Problem;
  next?: Problem;
  skillId?: string;
  position?: number;
  total?: number;
} {
  const problem = getProblem(problemId);
  if (!problem) return {};
  const ladder = getPrimaryProblemsForSkill(problem.skills.primary);
  const at = ladder.findIndex((p) => p.id === problemId);
  if (at === -1) return { skillId: problem.skills.primary };
  return {
    ...(at > 0 && ladder[at - 1] ? { previous: ladder[at - 1] as Problem } : {}),
    ...(at < ladder.length - 1 && ladder[at + 1] ? { next: ladder[at + 1] as Problem } : {}),
    skillId: problem.skills.primary,
    position: at + 1,
    total: ladder.length,
  };
}
