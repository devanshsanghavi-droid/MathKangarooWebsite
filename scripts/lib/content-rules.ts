/**
 * Every content rule this repo enforces, in one place.
 *
 * `validateContent()` walks a content root and returns a flat list of findings. It never
 * throws on bad content and never calls process.exit — that is the CLI's job — so the same
 * function can be pointed at `scripts/__fixtures__/` from a unit test.
 *
 * Rule ids are stable strings. Tests assert on them; do not rename one without updating
 * scripts/__tests__/content-rules.test.ts.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import {
  SkillSchema,
  ProblemSchema,
  PaperIndexSchema,
  strandOf,
  type Skill,
  type Problem,
  type PaperIndex,
} from '../../src/lib/schemas.ts';

export type RuleId =
  | 'schema/skill'
  | 'schema/problem'
  | 'schema/paper'
  | 'schema/json-parse'
  | 'skill/id-matches-path'
  | 'skill/duplicate-id'
  | 'skill/prerequisite-exists'
  | 'skill/acyclic'
  | 'skill/unlocks-derived'
  | 'skill/canonical-problem-exists'
  | 'problem/id-matches-path'
  | 'problem/duplicate-id'
  | 'problem/exactly-one-correct'
  | 'problem/misconception-required'
  | 'problem/correct-choice-no-misconception'
  | 'problem/choice-keys'
  | 'problem/figure-alt-required'
  | 'problem/figure-component-exists'
  | 'problem/skill-exists'
  | 'paper/filename-matches'
  | 'paper/duplicate'
  | 'paper/skill-exists'
  | 'paper/size-cap';

export interface Finding {
  rule: RuleId;
  file: string;
  message: string;
}

type AddFinding = (rule: RuleId, file: string, message: string) => void;

export interface ContentBundle {
  skills: Map<string, Skill>;
  problems: Map<string, Problem>;
  papers: Map<string, PaperIndex>;
}

export interface ValidateOptions {
  /** Directory holding skills/, problems/, papers/. */
  contentDir: string;
  /** Directory holding the figure components. Existence checks are skipped if absent. */
  figuresDir?: string;
}

export interface ValidateResult {
  findings: Finding[];
  bundle: ContentBundle;
  counts: { skills: number; problems: number; papers: number };
}

/**
 * A paper index file holds question numbers, point values and our skill tags. That is a
 * few hundred bytes. Anything approaching 2KB means someone started pasting the actual
 * questions in, which would put the whole project on the wrong side of copyright.
 * This cap is a deliberate tripwire, not a performance limit. Do not raise it.
 */
export const PAPER_FILE_MAX_BYTES = 2048;

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function formatZodIssues(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const issues = (error as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues;
    return issues
      .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('; ');
  }
  return String(error);
}

/* -------------------------------------------------------------------------- */
/* Graph helpers (exported: the Atlas and the unlocks script reuse them)       */
/* -------------------------------------------------------------------------- */

/**
 * Depth-first cycle search over the prerequisite edges. Returns the first cycle found as a
 * list of skill ids, `null` when the graph is acyclic. Deterministic: nodes and edges are
 * visited in sorted id order, so the same graph always reports the same cycle.
 */
export function findCycle(prerequisites: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const ids = [...prerequisites.keys()].sort();
  for (const id of ids) color.set(id, WHITE);

  let cycle: string[] | null = null;

  const visit = (node: string): boolean => {
    color.set(node, GREY);
    stack.push(node);
    for (const next of [...(prerequisites.get(node) ?? [])].sort()) {
      if (!color.has(next)) continue; // dangling edge: reported by prerequisite-exists
      const c = color.get(next);
      if (c === GREY) {
        const start = stack.indexOf(next);
        cycle = [...stack.slice(start), next];
        return true;
      }
      if (c === WHITE && visit(next)) return true;
    }
    stack.pop();
    color.set(node, BLACK);
    return false;
  };

  for (const id of ids) {
    if (color.get(id) === WHITE && visit(id)) break;
  }
  return cycle;
}

/** `unlocks[x]` is exactly the set of skills that list `x` as a prerequisite, sorted. */
export function deriveUnlocks(prerequisites: Map<string, string[]>): Map<string, string[]> {
  const unlocks = new Map<string, string[]>();
  for (const id of prerequisites.keys()) unlocks.set(id, []);
  for (const [id, prereqs] of [...prerequisites.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const prereq of prereqs) {
      const bucket = unlocks.get(prereq);
      if (bucket && !bucket.includes(id)) bucket.push(id);
    }
  }
  for (const list of unlocks.values()) list.sort();
  return unlocks;
}

/* -------------------------------------------------------------------------- */
/* Raw guardrails                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The two rules that ARE the product run against the raw JSON, before Zod.
 *
 * If they ran after the schema, a missing `alt` or a one-word `misconception` would surface
 * as a generic "string too short" and the author would never read the sentence explaining
 * why the field exists. Running first costs one extra pass and buys a failure message that
 * teaches. Both rules are re-expressed in the schema, so neither can slip through.
 */
function rawProblemGuardrails(value: unknown, file: string, add: AddFinding): void {
  if (typeof value !== 'object' || value === null) return;
  const record = value as Record<string, unknown>;

  const choices = record.choices;
  if (Array.isArray(choices)) {
    for (const entry of choices) {
      if (typeof entry !== 'object' || entry === null) continue;
      const choice = entry as Record<string, unknown>;
      const key = typeof choice.key === 'string' ? choice.key : '?';
      const isCorrect = choice.correct === true;
      const misconception = choice.misconception;
      const written = typeof misconception === 'string' && misconception.trim().length > 0;
      if (!isCorrect && !written) {
        add(
          'problem/misconception-required',
          file,
          `choice ${key} is incorrect and has no misconception. Distractor-specific feedback ` +
            'is the product: write the student thinking that produces this answer, in the ' +
            "student's own voice.",
        );
      }
    }
  }

  const figure = record.figure;
  if (figure && typeof figure === 'object') {
    const alt = (figure as Record<string, unknown>).alt;
    const text = typeof alt === 'string' ? alt.trim() : '';
    if (text.length < 20) {
      add(
        'problem/figure-alt-required',
        file,
        'figure is present but its alt text is missing, blank, or too short. Describe what a ' +
          'sighted solver EXTRACTS from the figure, not what it looks like.',
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* The validator                                                               */
/* -------------------------------------------------------------------------- */

export function validateContent(options: ValidateOptions): ValidateResult {
  const { contentDir, figuresDir } = options;
  const findings: Finding[] = [];
  const rel = (f: string) => relative(process.cwd(), f) || f;
  const add = (rule: RuleId, file: string, message: string): void => {
    findings.push({ rule, file: rel(file), message });
  };

  const skills = new Map<string, Skill>();
  const problems = new Map<string, Problem>();
  const papers = new Map<string, PaperIndex>();

  /* ---------------------------------------------------------------- skills */

  const skillFiles = listJsonFiles(join(contentDir, 'skills'));
  const skillIdSeen = new Map<string, string>();

  for (const file of skillFiles) {
    const raw = readJson(file);
    if (!raw.ok) {
      add('schema/json-parse', file, `not valid JSON — ${raw.message}`);
      continue;
    }
    const parsed = SkillSchema.safeParse(raw.value);
    if (!parsed.success) {
      add('schema/skill', file, formatZodIssues(parsed.error));
      continue;
    }
    const skill = parsed.data;

    const expectedName = `${skill.id}.json`;
    if (basename(file) !== expectedName) {
      add('skill/id-matches-path', file, `id ${skill.id} expects the filename ${expectedName}`);
    }
    const parentDir = file.split(sep).at(-2);
    if (parentDir !== skill.strand) {
      add(
        'skill/id-matches-path',
        file,
        `strand ${skill.strand} expects the folder content/skills/${skill.strand}/`,
      );
    }
    if (strandOf(skill.id) !== skill.strand) {
      add(
        'skill/id-matches-path',
        file,
        `id prefix of ${skill.id} disagrees with strand ${skill.strand}`,
      );
    }

    const previous = skillIdSeen.get(skill.id);
    if (previous) {
      add(
        'skill/duplicate-id',
        file,
        `skill id ${skill.id} is already defined in ${rel(previous)}`,
      );
      continue;
    }
    skillIdSeen.set(skill.id, file);
    skills.set(skill.id, skill);
  }

  // Prerequisite references must resolve.
  const prerequisites = new Map<string, string[]>();
  for (const [id, skill] of skills) prerequisites.set(id, skill.prerequisites);

  for (const [id, skill] of skills) {
    for (const prereq of skill.prerequisites) {
      if (!skills.has(prereq)) {
        add(
          'skill/prerequisite-exists',
          skillIdSeen.get(id) ?? id,
          `${id} lists prerequisite ${prereq}, which is not a skill in the Atlas`,
        );
      }
      if (prereq === id) {
        add('skill/acyclic', skillIdSeen.get(id) ?? id, `${id} lists itself as a prerequisite`);
      }
    }
  }

  // The prerequisite graph must be a DAG.
  const cycle = findCycle(prerequisites);
  if (cycle) {
    add(
      'skill/acyclic',
      join(contentDir, 'skills'),
      `prerequisite graph contains a cycle: ${cycle.join(' -> ')}`,
    );
  }

  // `unlocks` is derived, never hand-written.
  const derived = deriveUnlocks(prerequisites);
  for (const [id, skill] of skills) {
    const expected = derived.get(id) ?? [];
    const actual = [...skill.unlocks].sort();
    if (expected.join(',') !== actual.join(',')) {
      add(
        'skill/unlocks-derived',
        skillIdSeen.get(id) ?? id,
        `unlocks is stale — expected [${expected.join(', ')}], found [${actual.join(', ')}]. ` +
          'Run `pnpm derive:unlocks`; never hand-edit this field.',
      );
    }
  }

  /* -------------------------------------------------------------- problems */

  const problemFiles = listJsonFiles(join(contentDir, 'problems'));
  const problemIdSeen = new Map<string, string>();

  for (const file of problemFiles) {
    const raw = readJson(file);
    if (!raw.ok) {
      add('schema/json-parse', file, `not valid JSON — ${raw.message}`);
      continue;
    }
    rawProblemGuardrails(raw.value, file, add);

    const parsed = ProblemSchema.safeParse(raw.value);
    if (!parsed.success) {
      add('schema/problem', file, formatZodIssues(parsed.error));
      continue;
    }
    const problem = parsed.data;

    const expectedName = `${problem.id}.json`;
    if (basename(file) !== expectedName) {
      add('problem/id-matches-path', file, `id ${problem.id} expects the filename ${expectedName}`);
    }
    const parentDir = file.split(sep).at(-2);
    if (parentDir !== problem.band) {
      add(
        'problem/id-matches-path',
        file,
        `band ${problem.band} expects the folder content/problems/${problem.band}/`,
      );
    }

    const previous = problemIdSeen.get(problem.id);
    if (previous) {
      add(
        'problem/duplicate-id',
        file,
        `problem id ${problem.id} is already defined in ${rel(previous)}`,
      );
      continue;
    }
    problemIdSeen.set(problem.id, file);
    problems.set(problem.id, problem);

    // Exactly one correct choice, keys A–E exactly once each.
    const correct = problem.choices.filter((c) => c.correct);
    if (correct.length !== 1) {
      add(
        'problem/exactly-one-correct',
        file,
        `expected exactly 1 correct choice, found ${correct.length}`,
      );
    }
    const keys = problem.choices.map((c) => c.key);
    const expectedKeys = ['A', 'B', 'C', 'D', 'E'];
    if ([...keys].sort().join('') !== expectedKeys.join('')) {
      add('problem/choice-keys', file, `choice keys must be exactly A–E, found ${keys.join('')}`);
    }

    // The other half of the biconditional: a correct choice carries no misconception.
    // (The "wrong choice must have one" half runs before the schema, in rawProblemGuardrails.)
    for (const choice of problem.choices) {
      if (choice.correct && choice.misconception !== null) {
        add(
          'problem/correct-choice-no-misconception',
          file,
          `choice ${choice.key} is correct, so its misconception must be null`,
        );
      }
    }

    // The figure component named in the JSON must resolve to a real file.
    if (problem.figure) {
      if (figuresDir) {
        const candidates = [
          join(figuresDir, `${problem.figure.component}.tsx`),
          join(figuresDir, `${problem.figure.component}.jsx`),
        ];
        if (!candidates.some((c) => existsSync(c))) {
          add(
            'problem/figure-component-exists',
            file,
            `figure component ${problem.figure.component} has no file in ${rel(figuresDir)}`,
          );
        }
      }
    }

    // GUARDRAIL: no problem may reference a skill that is not in the Atlas.
    const referenced = [problem.skills.primary, ...problem.skills.secondary];
    for (const skillId of referenced) {
      if (!skills.has(skillId)) {
        add('problem/skill-exists', file, `references skill ${skillId}, which is not in the Atlas`);
      }
    }
    if (problem.skills.secondary.includes(problem.skills.primary)) {
      add(
        'problem/skill-exists',
        file,
        `primary skill ${problem.skills.primary} is repeated in secondary`,
      );
    }
  }

  // A skill's canonical problem must exist.
  for (const [id, skill] of skills) {
    if (skill.canonicalProblem && !problems.has(skill.canonicalProblem)) {
      add(
        'skill/canonical-problem-exists',
        skillIdSeen.get(id) ?? id,
        `canonicalProblem ${skill.canonicalProblem} is not a problem in content/problems/`,
      );
    }
  }

  /* ---------------------------------------------------------------- papers */

  const paperFiles = listJsonFiles(join(contentDir, 'papers'));
  const paperKeySeen = new Map<string, string>();

  for (const file of paperFiles) {
    // GUARDRAIL (tripwire): paper index files hold analysis, never problem text.
    const bytes = statSync(file).size;
    if (bytes > PAPER_FILE_MAX_BYTES) {
      add(
        'paper/size-cap',
        file,
        `${bytes} bytes exceeds the ${PAPER_FILE_MAX_BYTES}-byte cap on content/papers/. ` +
          'This cap is an anti-paste tripwire: a paper index is question numbers, point ' +
          'values and our skill tags. If it grew, official problem text may have been ' +
          'pasted in. Do not raise the cap.',
      );
    }

    const raw = readJson(file);
    if (!raw.ok) {
      add('schema/json-parse', file, `not valid JSON — ${raw.message}`);
      continue;
    }
    const parsed = PaperIndexSchema.safeParse(raw.value);
    if (!parsed.success) {
      add('schema/paper', file, formatZodIssues(parsed.error));
      continue;
    }
    const paper = parsed.data;
    const key = `${paper.year}-${paper.band}`;

    if (basename(file) !== `${key}.json`) {
      add('paper/filename-matches', file, `expects the filename ${key}.json`);
    }
    const previous = paperKeySeen.get(key);
    if (previous) {
      add('paper/duplicate', file, `paper ${key} is already defined in ${rel(previous)}`);
      continue;
    }
    paperKeySeen.set(key, file);
    papers.set(key, paper);

    for (const question of paper.questions) {
      for (const skillId of question.skills) {
        if (!skills.has(skillId)) {
          add(
            'paper/skill-exists',
            file,
            `question ${question.number} tags skill ${skillId}, which is not in the Atlas`,
          );
        }
      }
    }
  }

  return {
    findings,
    bundle: { skills, problems, papers },
    counts: { skills: skills.size, problems: problems.size, papers: papers.size },
  };
}
