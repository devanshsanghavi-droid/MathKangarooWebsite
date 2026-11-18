import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProblemSchema, SkillSchema, type Problem, type Skill } from '../../src/lib/schemas.ts';
import {
  buildAmcIndex,
  buildAmcLookups,
  buildKaIndex,
  buildKaLookups,
  kaSkillNames,
  amcTopicNames,
  buildTestIndexFile,
  testSkillNames,
} from '../../src/lib/bank-data.ts';
import { amcPracticeItem, kaPracticeItem, testPracticeItem } from '../../src/lib/practice-item.ts';
import { buildAmcIndex as loadAmcIndex } from '../../src/lib/amc-content.ts';
import { buildTestIndex as loadTestIndex } from '../../src/lib/test-content.ts';
import { STD_TESTS, TEST_SLUG, type StdTest } from '../../src/lib/test-meta.ts';

/**
 * Writes the static bank data (docs/06 §3) for one content directory. The CLI is
 * scripts/build-static-data.ts; this is split out so a test can point it at a fixture tree.
 *
 * Kangaroo content is required. AMC content is optional: with no `content/amc/taxonomy.json`
 * the AMC files are simply not written, so the Kangaroo bank builds before the beta exists.
 */

export interface StaticDataResult {
  ka: { problems: number; skills: number };
  amc: { problems: number } | null;
  /** Problems per test; a test with no content/tests/<slug>/taxonomy.json is absent. */
  tests: Partial<Record<StdTest, number>>;
  files: number;
}

function listJson(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listJson(full, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function parse<T>(file: string, schema: { parse: (value: unknown) => T }): T {
  try {
    return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${file} is not valid content. Run pnpm validate:content.\n${reason}`);
  }
}

/** Compact JSON: these files are fetched by browsers, not read by people. */
function write(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}

export function loadKangaroo(contentDir: string): { skills: Skill[]; problems: Problem[] } {
  return {
    skills: listJson(join(contentDir, 'skills')).map((file) => parse(file, SkillSchema)),
    problems: listJson(join(contentDir, 'problems')).map((file) => parse(file, ProblemSchema)),
  };
}

function writeKangaroo(
  contentDir: string,
  outDir: string,
): StaticDataResult['ka'] & { files: number } {
  const { skills, problems } = loadKangaroo(contentDir);
  if (problems.length === 0) throw new Error(`no Kangaroo problems under ${contentDir}`);
  const lookups = buildKaLookups(skills, problems);
  const names = kaSkillNames(lookups);
  write(join(outDir, 'ka-index.json'), buildKaIndex(problems));
  write(join(outDir, 'ka-lookups.json'), lookups);
  for (const problem of problems) {
    write(
      join(outDir, 'p', `${problem.id}.json`),
      kaPracticeItem(problem, (id) => names.get(id)),
    );
  }
  return { problems: problems.length, skills: skills.length, files: problems.length + 2 };
}

/**
 * The AMC half. Uses the beta's own loader (src/lib/amc-content.ts), which validates every file
 * against AmcProblemSchema and the taxonomy schema and throws on anything invalid.
 */
function writeAmc(contentDir: string, outDir: string): { problems: number; files: number } | null {
  const amcDir = join(contentDir, 'amc');
  if (!existsSync(join(amcDir, 'taxonomy.json'))) return null;
  const index = loadAmcIndex(amcDir);
  const lookups = buildAmcLookups(index.taxonomy, index.problems);
  const names = amcTopicNames(lookups);
  write(join(outDir, 'amc-index.json'), buildAmcIndex(index.problems));
  write(join(outDir, 'amc-lookups.json'), lookups);
  for (const problem of index.problems) {
    write(
      join(outDir, 'p', `${problem.id}.json`),
      amcPracticeItem(problem, (id) => names.get(id)),
    );
  }
  return { problems: index.problems.length, files: index.problems.length + 2 };
}

/**
 * The SAT / ACT half: `<slug>-index.json` plus `p/<ID>.json` per problem, through the tests'
 * own loader (src/lib/test-content.ts), which throws on anything invalid. Optional per test.
 */
function writeTests(
  contentDir: string,
  outDir: string,
): { tests: Partial<Record<StdTest, number>>; files: number } {
  const tests: Partial<Record<StdTest, number>> = {};
  let files = 0;
  for (const test of STD_TESTS) {
    const slug = TEST_SLUG[test];
    const dir = join(contentDir, 'tests', slug);
    if (!existsSync(join(dir, 'taxonomy.json'))) continue;
    const index = loadTestIndex(dir, test);
    const file = buildTestIndexFile(index.taxonomy, index.problems);
    const names = testSkillNames(file);
    write(join(outDir, `${slug}-index.json`), file);
    for (const problem of index.problems) {
      write(
        join(outDir, 'p', `${problem.id}.json`),
        testPracticeItem(problem, (id) => names.get(id)),
      );
    }
    tests[test] = index.problems.length;
    files += index.problems.length + 1;
  }
  return { tests, files };
}

export function writeStaticData({
  contentDir,
  outDir,
}: {
  contentDir: string;
  outDir: string;
}): StaticDataResult {
  // Start clean, so a deleted problem does not leave a stale file behind for a browser to fetch.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'p'), { recursive: true });
  const ka = writeKangaroo(contentDir, outDir);
  const amc = writeAmc(contentDir, outDir);
  const tests = writeTests(contentDir, outDir);
  return {
    ka: { problems: ka.problems, skills: ka.skills },
    amc: amc ? { problems: amc.problems } : null,
    tests: tests.tests,
    files: ka.files + (amc?.files ?? 0) + tests.files,
  };
}
