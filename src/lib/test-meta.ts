/**
 * SAT / ACT ("standardized tests") ids, difficulty and progress points.
 *
 * Dependency-free on purpose, like amc-tier.ts: the browser-side progress store
 * (local-progress.ts) and the practice adapter need these, and Zod has no business in that
 * bundle. test-schemas.ts re-exports everything here.
 *
 * Source of truth: docs/07-EXAMS-PROGRESS-MOCKS.md section 3.
 *
 *   problem id   SA-0001 (SAT), AC-0001 (ACT)
 *   domain id    SAT: ALG ADV PSD GEO     ACT: NQ ALG FUN GEO STAT
 *   skill id     <DOMAIN>-NN, e.g. ADV-03. Namespaced per test: ALG-01 on the SAT and ALG-01
 *                on the ACT are different skills, and neither is a Kangaroo or AMC id.
 *
 * Progress points (easy 3, medium 4, hard 5) exist only so these attempts fit the same
 * AttemptRecord shape as Kangaroo and AMC attempts. They are never shown to a student.
 */

export const STD_TESTS = ['SAT', 'ACT'] as const;
export type StdTest = (typeof STD_TESTS)[number];

export const TEST_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type TestDifficulty = (typeof TEST_DIFFICULTIES)[number];

export const SAT_DOMAINS = ['ALG', 'ADV', 'PSD', 'GEO'] as const;
export const ACT_DOMAINS = ['NQ', 'ALG', 'FUN', 'GEO', 'STAT'] as const;
export type SatDomain = (typeof SAT_DOMAINS)[number];
export type ActDomain = (typeof ACT_DOMAINS)[number];
export type TestDomain = SatDomain | ActDomain;
/** Every domain id used by either test, once each. */
export const ALL_TEST_DOMAINS = ['ALG', 'ADV', 'PSD', 'GEO', 'NQ', 'FUN', 'STAT'] as const;

export const TEST_DOMAINS: Readonly<Record<StdTest, readonly TestDomain[]>> = {
  SAT: SAT_DOMAINS,
  ACT: ACT_DOMAINS,
};

/** Id prefix per test. */
export const TEST_ID_PREFIX: Readonly<Record<StdTest, 'SA' | 'AC'>> = { SAT: 'SA', ACT: 'AC' };

/** Folder under content/tests/ and the progress-key namespace. */
export const TEST_SLUG: Readonly<Record<StdTest, 'sat' | 'act'>> = { SAT: 'sat', ACT: 'act' };

export const SAT_PROBLEM_ID_RE = /^SA-\d{4}$/;
export const ACT_PROBLEM_ID_RE = /^AC-\d{4}$/;
export const TEST_PROBLEM_ID_RE = /^(SA|AC)-\d{4}$/;
/** Domain prefix + 2 digits. Which prefixes are legal depends on the test. */
export const TEST_SKILL_ID_RE = /^(ALG|ADV|PSD|GEO|NQ|FUN|STAT)-\d{2}$/;

export function isTestProblemId(id: string): boolean {
  return TEST_PROBLEM_ID_RE.test(id);
}

/** Which test a problem id belongs to, from its prefix. */
export function testOfProblemId(id: string): StdTest | null {
  if (SAT_PROBLEM_ID_RE.test(id)) return 'SAT';
  if (ACT_PROBLEM_ID_RE.test(id)) return 'ACT';
  return null;
}

/** The domain a skill id belongs to, read from its prefix (not checked against a test). */
export function testDomainOfSkill(skillId: string): TestDomain | null {
  const match = TEST_SKILL_ID_RE.exec(skillId);
  return match ? (match[1] as TestDomain) : null;
}

export function isTestDomain(test: StdTest, domain: string): domain is TestDomain {
  return (TEST_DOMAINS[test] as readonly string[]).includes(domain);
}

export const TEST_DIFFICULTY_POINTS: Readonly<Record<TestDifficulty, 3 | 4 | 5>> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

/** Points recorded in the progress store for an attempt at a problem of this difficulty. */
export function testPointsOf(difficulty: TestDifficulty): 3 | 4 | 5 {
  return TEST_DIFFICULTY_POINTS[difficulty];
}

export const TEST_LABEL: Readonly<Record<StdTest, string>> = { SAT: 'SAT Math', ACT: 'ACT Math' };

export const TEST_DIFFICULTY_LABEL: Readonly<Record<TestDifficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
