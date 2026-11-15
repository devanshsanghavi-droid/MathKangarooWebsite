import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AmcTaxonomySchema,
  AmcProblemSchema,
  FormulaSchema,
  AMC_AREAS,
  AMC_TIERS,
  amcInContest,
  amcTierOf,
  type AmcAreaId,
  type AmcFormulaContest,
  type AmcProblem,
  type AmcTaxonomy,
  type AmcTier,
  type Formula,
} from './amc-schemas.ts';

/**
 * The AMC beta content layer. BUILD-TIME ONLY.
 *
 * docs/06 section 3: request-time code must not depend on the server content bundle, so this
 * reads `content/amc/` straight from disk. Call it from Server Components that are statically
 * generated (`generateStaticParams` + `dynamicParams = false`), from `generateMetadata`, and
 * from build scripts such as scripts/build-static-data.ts. Never from a route that renders at
 * request time on Workers, where there is no content directory, and never from a client
 * component (it imports node:fs).
 *
 * Deliberately no `import 'server-only'`: that package throws when Node loads it outside the
 * react-server condition, and build scripts run under plain Node. Imports use explicit `.ts`
 * extensions for the same reason.
 *
 * `buildAmcIndex(dir)` is a pure function of a directory and throws on anything invalid
 * (`pnpm validate:content` is the friendly reporter; this is the backstop). `amcIndex()`
 * memoises the index built from the repo's own content/amc/.
 */

export interface AmcCounts {
  total: number;
  byArea: ReadonlyMap<AmcAreaId, number>;
  byTopic: ReadonlyMap<string, number>;
  byType: ReadonlyMap<string, number>;
  byTier: ReadonlyMap<AmcTier, number>;
  /** AMC10 and AMC12 each include the BOTH problems, so they can add to more than total. */
  byContest: ReadonlyMap<AmcFormulaContest, number>;
}

export interface AmcIndex {
  taxonomy: AmcTaxonomy;
  /** Sorted by id. */
  problems: readonly AmcProblem[];
  /** Sorted by area (ALG, GEO, NT, CP), then must-know first, then id. */
  formulas: readonly Formula[];
  problemById: ReadonlyMap<string, AmcProblem>;
  formulaById: ReadonlyMap<string, Formula>;
  counts: AmcCounts;
}

function listJson(dir: string): string[] {
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

function parseFile<T>(file: string, schema: { parse: (v: unknown) => T }): T {
  try {
    return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid AMC content in ${file}. Run pnpm validate:content.\n${reason}`);
  }
}

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function countAmcProblems(problems: readonly AmcProblem[]): AmcCounts {
  const byArea = new Map<AmcAreaId, number>(AMC_AREAS.map((a) => [a, 0]));
  const byTier = new Map<AmcTier, number>(AMC_TIERS.map((t) => [t, 0]));
  const byContest = new Map<AmcFormulaContest, number>([
    ['AMC10', 0],
    ['AMC12', 0],
  ]);
  const byTopic = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const problem of problems) {
    bump(byArea, problem.area);
    bump(byTier, amcTierOf(problem.slot));
    bump(byTopic, problem.topic);
    for (const type of problem.types) bump(byType, type);
    if (amcInContest(problem.contest, 'AMC10')) bump(byContest, 'AMC10');
    if (amcInContest(problem.contest, 'AMC12')) bump(byContest, 'AMC12');
  }
  return { total: problems.length, byArea, byTopic, byType, byTier, byContest };
}

const AREA_ORDER = new Map<string, number>(AMC_AREAS.map((a, i) => [a, i]));

export function buildAmcIndex(amcDir: string): AmcIndex {
  const taxonomy = parseFile(join(amcDir, 'taxonomy.json'), AmcTaxonomySchema);
  const problems = listJson(join(amcDir, 'problems'))
    .map((file) => parseFile(file, AmcProblemSchema))
    .sort((a, b) => a.id.localeCompare(b.id));
  const formulas = listJson(join(amcDir, 'formulas'))
    .map((file) => parseFile(file, FormulaSchema))
    .sort(
      (a, b) =>
        (AREA_ORDER.get(a.area) ?? 0) - (AREA_ORDER.get(b.area) ?? 0) ||
        Number(a.priority !== 'must-know') - Number(b.priority !== 'must-know') ||
        a.id.localeCompare(b.id),
    );
  return {
    taxonomy,
    problems,
    formulas,
    problemById: new Map(problems.map((p) => [p.id, p])),
    formulaById: new Map(formulas.map((f) => [f.id, f])),
    counts: countAmcProblems(problems),
  };
}

let cached: AmcIndex | null = null;

export function amcIndex(): AmcIndex {
  cached ??= buildAmcIndex(join(process.cwd(), 'content', 'amc'));
  return cached;
}

/* -------------------------------------------------------------------------- */
/* Accessors                                                                   */
/* -------------------------------------------------------------------------- */

export function getAmcTaxonomy(): AmcTaxonomy {
  return amcIndex().taxonomy;
}

export function getAllAmcProblems(): readonly AmcProblem[] {
  return amcIndex().problems;
}

export function getAmcProblem(id: string): AmcProblem | undefined {
  return amcIndex().problemById.get(id);
}

/** Problems that belong on a given paper; BOTH problems appear under either contest. */
export function getAmcProblemsFor(contest: AmcFormulaContest): readonly AmcProblem[] {
  return amcIndex().problems.filter((p) => amcInContest(p.contest, contest));
}

export function getAmcProblemsOfType(typeId: string): readonly AmcProblem[] {
  return amcIndex().problems.filter((p) => p.types.includes(typeId));
}

export function getAmcFormulas(): readonly Formula[] {
  return amcIndex().formulas;
}

export function getAmcFormula(id: string): Formula | undefined {
  return amcIndex().formulaById.get(id);
}

/**
 * Formulas a problem type leans on: those that name the type in `types`, plus any formula a
 * problem of that type cites. Sorted like getAmcFormulas.
 */
export function getAmcFormulasForType(typeId: string): readonly Formula[] {
  const cited = new Set(getAmcProblemsOfType(typeId).flatMap((p) => p.formulas));
  return amcIndex().formulas.filter((f) => f.types?.includes(typeId) || cited.has(f.id));
}

export function getAmcCounts(): AmcCounts {
  return amcIndex().counts;
}
