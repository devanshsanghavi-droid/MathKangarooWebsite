import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  TestTaxonomySchema,
  TestProblemSchema,
  STD_TESTS,
  TEST_DIFFICULTIES,
  TEST_DOMAINS,
  TEST_SLUG,
  testOfProblemId,
  type StdTest,
  type TestDifficulty,
  type TestDomain,
  type TestProblem,
  type TestSkill,
  type TestTaxonomy,
} from './test-schemas.ts';

/**
 * The SAT / ACT content layer. BUILD-TIME ONLY, exactly like amc-content.ts.
 *
 * Reads `content/tests/<sat|act>/` straight from disk. Call it from statically generated
 * Server Components (`generateStaticParams` + `dynamicParams = false`), from
 * `generateMetadata`, and from build scripts such as scripts/build-static-data.ts. Never from
 * a route that renders at request time on Workers and never from a client component (it
 * imports node:fs).
 *
 * `buildTestIndex(dir, test)` is a pure function of a directory and throws on anything invalid
 * (`pnpm validate:content` is the friendly reporter; this is the backstop). `testIndex(test)`
 * memoises the index built from the repo's own content/tests/.
 */

export interface TestCounts {
  total: number;
  byDomain: ReadonlyMap<TestDomain, number>;
  bySkill: ReadonlyMap<string, number>;
  byDifficulty: ReadonlyMap<TestDifficulty, number>;
}

export interface TestIndex {
  test: StdTest;
  taxonomy: TestTaxonomy;
  /** Sorted by id. */
  problems: readonly TestProblem[];
  problemById: ReadonlyMap<string, TestProblem>;
  /** Skill id -> skill and the domain it sits in. */
  skillById: ReadonlyMap<string, { skill: TestSkill; domain: TestDomain }>;
  counts: TestCounts;
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(dir, e.name))
    .sort();
}

function parseFile<T>(file: string, schema: { parse: (v: unknown) => T }): T {
  try {
    return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid SAT/ACT content in ${file}. Run pnpm validate:content.\n${reason}`);
  }
}

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function countTestProblems(test: StdTest, problems: readonly TestProblem[]): TestCounts {
  const byDomain = new Map<TestDomain, number>(TEST_DOMAINS[test].map((d) => [d, 0]));
  const byDifficulty = new Map<TestDifficulty, number>(TEST_DIFFICULTIES.map((d) => [d, 0]));
  const bySkill = new Map<string, number>();
  for (const problem of problems) {
    bump(byDomain, problem.domain as TestDomain);
    bump(byDifficulty, problem.difficulty);
    bump(bySkill, problem.skill);
  }
  return { total: problems.length, byDomain, bySkill, byDifficulty };
}

/** `testDir` is content/tests/<sat|act>. */
export function buildTestIndex(testDir: string, test: StdTest): TestIndex {
  const taxonomy = parseFile(join(testDir, 'taxonomy.json'), TestTaxonomySchema);
  if (taxonomy.test !== test) {
    throw new Error(`taxonomy in ${testDir} is for ${taxonomy.test}, expected ${test}`);
  }
  const problems = listJson(join(testDir, 'problems'))
    .map((file) => parseFile(file, TestProblemSchema))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const p of problems) {
    if (p.test !== test) throw new Error(`${p.id} is tagged ${p.test} but lives under ${test}`);
  }
  const skillById = new Map<string, { skill: TestSkill; domain: TestDomain }>();
  for (const domain of taxonomy.domains) {
    for (const skill of domain.skills) {
      skillById.set(skill.id, { skill, domain: domain.id as TestDomain });
    }
  }
  return {
    test,
    taxonomy,
    problems,
    problemById: new Map(problems.map((p) => [p.id, p])),
    skillById,
    counts: countTestProblems(test, problems),
  };
}

const cached = new Map<StdTest, TestIndex>();

export function testIndex(test: StdTest): TestIndex {
  let index = cached.get(test);
  if (!index) {
    index = buildTestIndex(join(process.cwd(), 'content', 'tests', TEST_SLUG[test]), test);
    cached.set(test, index);
  }
  return index;
}

/* -------------------------------------------------------------------------- */
/* Accessors                                                                   */
/* -------------------------------------------------------------------------- */

export function getTestTaxonomy(test: StdTest): TestTaxonomy {
  return testIndex(test).taxonomy;
}

export function getAllTestProblems(test: StdTest): readonly TestProblem[] {
  return testIndex(test).problems;
}

/** Looks the id up in the right test from its prefix (SA- or AC-). */
export function getTestProblem(id: string): TestProblem | undefined {
  const test = testOfProblemId(id);
  return test ? testIndex(test).problemById.get(id) : undefined;
}

export function getTestSkill(
  test: StdTest,
  skillId: string,
): { skill: TestSkill; domain: TestDomain } | undefined {
  return testIndex(test).skillById.get(skillId);
}

export function getTestProblemsInDomain(test: StdTest, domain: TestDomain): readonly TestProblem[] {
  return testIndex(test).problems.filter((p) => p.domain === domain);
}

export function getTestCounts(test: StdTest): TestCounts {
  return testIndex(test).counts;
}

export { STD_TESTS };
