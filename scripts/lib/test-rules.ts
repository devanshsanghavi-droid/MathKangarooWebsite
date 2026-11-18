/**
 * Every content rule for the SAT / ACT banks (`content/tests/`), in one place.
 *
 * Kept apart from content-rules.ts and amc-rules.ts so the Kangaroo and AMC rules stay exactly
 * as they were. The CLI (scripts/validate-content.ts) runs all three and reports them
 * together. Never throws on bad content and never exits, so tests can point it at fixtures.
 *
 * Rule ids are stable strings; scripts/__tests__/test-rules.test.ts asserts on them.
 * Source of truth: docs/07-EXAMS-PROGRESS-MOCKS.md section 3.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import { checkProblemRules } from '../../src/lib/problem-rules.ts';
import {
  TestTaxonomySchema,
  TestProblemSchema,
  STD_TESTS,
  TEST_DOMAINS,
  TEST_SLUG,
  TEST_CHOICE_KEYS,
  testDomainOfSkill,
  testOfProblemId,
  type StdTest,
  type TestTaxonomy,
  type TestProblem,
  type TestSkill,
} from '../../src/lib/test-schemas.ts';

export type TestRuleId =
  | 'tests/json-parse'
  | 'tests/schema-taxonomy'
  | 'tests/schema-problem'
  | 'tests/taxonomy-missing'
  | 'tests/taxonomy-test-matches'
  | 'tests/taxonomy-domains'
  | 'tests/taxonomy-duplicate-id'
  | 'tests/skill-domain-prefix'
  | 'tests/problem-id-matches-path'
  | 'tests/problem-duplicate-id'
  | 'tests/problem-exactly-one-correct'
  | 'tests/problem-choice-keys'
  | 'tests/misconception-required'
  | 'tests/correct-choice-no-misconception'
  | 'tests/figure-alt-required'
  | 'tests/figure-component-exists'
  | 'tests/domain-in-test'
  | 'tests/skill-exists'
  | 'tests/skill-domain-matches';

export interface TestFinding {
  rule: TestRuleId;
  file: string;
  message: string;
}

export interface TestValidateOptions {
  /** Directory holding tests/ (i.e. the repo's content/). */
  contentDir: string;
  /** Directory holding the figure components. Existence checks are skipped if absent. */
  figuresDir?: string;
}

export interface TestValidateResult {
  findings: TestFinding[];
  taxonomies: Partial<Record<StdTest, TestTaxonomy>>;
  problems: Map<string, TestProblem>;
  counts: { SAT: number; ACT: number };
}

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

/** The shared Kangaroo guardrails, renamed into the tests/ namespace. Same text, same rule. */
const GUARDRAIL_RENAME = {
  'problem/misconception-required': 'tests/misconception-required',
  'problem/correct-choice-no-misconception': 'tests/correct-choice-no-misconception',
  'problem/figure-alt-required': 'tests/figure-alt-required',
} as const satisfies Record<string, TestRuleId>;

export function validateTestContent(options: TestValidateOptions): TestValidateResult {
  const { contentDir, figuresDir } = options;
  const testsDir = join(contentDir, 'tests');
  const findings: TestFinding[] = [];
  const rel = (f: string) => relative(process.cwd(), f) || f;
  const add = (rule: TestRuleId, file: string, message: string): void => {
    findings.push({ rule, file: rel(file), message });
  };

  const taxonomies: Partial<Record<StdTest, TestTaxonomy>> = {};
  const problems = new Map<string, TestProblem>();
  const counts = { SAT: 0, ACT: 0 };
  const problemIdSeen = new Map<string, string>();

  if (!existsSync(testsDir)) return { findings, taxonomies, problems, counts };

  for (const test of STD_TESTS) {
    const slug = TEST_SLUG[test];
    const dir = join(testsDir, slug);
    if (!existsSync(dir)) continue;

    /* ------------------------------------------------------------ taxonomy */

    const taxonomyFile = join(dir, 'taxonomy.json');
    let taxonomy: TestTaxonomy | null = null;
    if (!existsSync(taxonomyFile)) {
      add('tests/taxonomy-missing', taxonomyFile, `content/tests/${slug}/ has no taxonomy.json`);
    } else {
      const raw = readJson(taxonomyFile);
      if (!raw.ok) add('tests/json-parse', taxonomyFile, `not valid JSON - ${raw.message}`);
      else {
        const parsed = TestTaxonomySchema.safeParse(raw.value);
        if (!parsed.success) {
          add('tests/schema-taxonomy', taxonomyFile, formatZodIssues(parsed.error));
        } else taxonomy = parsed.data;
      }
    }

    const skillById = new Map<string, { skill: TestSkill; domain: string }>();
    if (taxonomy) {
      taxonomies[test] = taxonomy;
      if (taxonomy.test !== test) {
        add(
          'tests/taxonomy-test-matches',
          taxonomyFile,
          `test is ${taxonomy.test} but the file is in content/tests/${slug}/ (expected ${test})`,
        );
      }
      const expected = [...TEST_DOMAINS[test]].sort().join(',');
      const found = taxonomy.domains.map((d) => d.id).sort();
      if (found.join(',') !== expected) {
        add(
          'tests/taxonomy-domains',
          taxonomyFile,
          `${test} domains must be exactly ${TEST_DOMAINS[test].join(', ')} once each, ` +
            `found ${found.join(', ')}`,
        );
      }
      for (const domain of taxonomy.domains) {
        for (const skill of domain.skills) {
          if (skillById.has(skill.id)) {
            add('tests/taxonomy-duplicate-id', taxonomyFile, `skill id ${skill.id} appears twice`);
          }
          skillById.set(skill.id, { skill, domain: domain.id });
          if (testDomainOfSkill(skill.id) !== domain.id) {
            add(
              'tests/skill-domain-prefix',
              taxonomyFile,
              `skill ${skill.id} is listed under ${domain.id}; the id prefix must match`,
            );
          }
        }
      }
    }

    /* ------------------------------------------------------------ problems */

    for (const file of listJsonFiles(join(dir, 'problems'))) {
      const raw = readJson(file);
      if (!raw.ok) {
        add('tests/json-parse', file, `not valid JSON - ${raw.message}`);
        continue;
      }

      // GUARDRAIL: misconception on every wrong choice, alt text on every figure. Same shared
      // implementation as the Kangaroo and AMC banks, run before the schema so it teaches.
      for (const violation of checkProblemRules(raw.value)) {
        add(GUARDRAIL_RENAME[violation.rule], file, violation.message);
      }

      const parsed = TestProblemSchema.safeParse(raw.value);
      if (!parsed.success) {
        add('tests/schema-problem', file, formatZodIssues(parsed.error));
        continue;
      }
      const problem = parsed.data;

      if (basename(file) !== `${problem.id}.json`) {
        add('tests/problem-id-matches-path', file, `id ${problem.id} expects ${problem.id}.json`);
      }
      if (problem.test !== test || testOfProblemId(problem.id) !== test) {
        add(
          'tests/problem-id-matches-path',
          file,
          `files in content/tests/${slug}/problems/ must have test ${test} and an ` +
            `${test === 'SAT' ? 'SA' : 'AC'}- id; found test ${problem.test}, id ${problem.id}`,
        );
      }
      if (file.split(sep).at(-2) !== 'problems') {
        add(
          'tests/problem-id-matches-path',
          file,
          `problem files live directly in content/tests/${slug}/problems/`,
        );
      }

      const previous = problemIdSeen.get(problem.id);
      if (previous) {
        add(
          'tests/problem-duplicate-id',
          file,
          `problem ${problem.id} is already in ${rel(previous)}`,
        );
        continue;
      }
      problemIdSeen.set(problem.id, file);
      problems.set(problem.id, problem);
      counts[test] += 1;

      const correct = problem.choices.filter((c) => c.correct).length;
      if (correct !== 1) {
        add(
          'tests/problem-exactly-one-correct',
          file,
          `expected 1 correct choice, found ${correct}`,
        );
      }
      const keys = problem.choices.map((c) => c.key);
      if (keys.join('') !== TEST_CHOICE_KEYS.join('')) {
        add(
          'tests/problem-choice-keys',
          file,
          `choice keys must be exactly A, B, C, D in order, found ${keys.join('')}`,
        );
      }

      if (problem.figure && figuresDir) {
        const candidates = [
          join(figuresDir, `${problem.figure.component}.tsx`),
          join(figuresDir, `${problem.figure.component}.jsx`),
        ];
        if (!candidates.some((c) => existsSync(c))) {
          add(
            'tests/figure-component-exists',
            file,
            `figure component ${problem.figure.component} has no file in ${rel(figuresDir)}`,
          );
        }
      }

      if (!(TEST_DOMAINS[test] as readonly string[]).includes(problem.domain)) {
        add(
          'tests/domain-in-test',
          file,
          `domain ${problem.domain} is not a ${test} domain (${TEST_DOMAINS[test].join(', ')})`,
        );
      }

      if (taxonomy) {
        const entry = skillById.get(problem.skill);
        if (!entry) {
          add(
            'tests/skill-exists',
            file,
            `skill ${problem.skill} is not in content/tests/${slug}/taxonomy.json`,
          );
        } else if (entry.domain !== problem.domain) {
          add(
            'tests/skill-domain-matches',
            file,
            `domain ${problem.domain} disagrees with skill ${problem.skill}, which is in ${entry.domain}`,
          );
        }
      }
    }
  }

  return { findings, taxonomies, problems, counts };
}
