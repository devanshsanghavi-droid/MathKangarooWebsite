import type { MasteryState } from './mastery';
import { bucketOf, type StatusBucket } from './progress-summary';
import { TEST_DIFFICULTIES, type TestDifficulty } from './test-meta';

/**
 * Pure helpers for the SAT and ACT area homes (/sat, /act): solved counts per domain and the
 * "Start a mixed set" picker. Browser-safe (type imports and progress-summary only), like
 * amc-home.ts, which does the same job for the AMC landing.
 */

export interface TestHomeProblem {
  id: string;
  domain: string;
  skill: string;
  difficulty: TestDifficulty;
}

export const TEST_MIXED_SET_SIZE = 10;

export interface TestGroupProgress {
  total: number;
  solved: number;
  attempted: number;
}

/** Solved / attempted over any list of problems: the whole bank, one domain, one skill. */
export function testGroupProgress(
  problems: readonly { id: string }[],
  statuses: ReadonlyMap<string, MasteryState>,
): TestGroupProgress {
  let solved = 0;
  let attempted = 0;
  for (const problem of problems) {
    const bucket = bucketOf(statuses.get(problem.id) ?? 'unseen');
    if (bucket === 'solved') solved += 1;
    else if (bucket === 'attempted') attempted += 1;
  }
  return { total: problems.length, solved, attempted };
}

const DIFFICULTY_RANK: Readonly<Record<TestDifficulty, number>> = Object.fromEntries(
  TEST_DIFFICULTIES.map((difficulty, index) => [difficulty, index]),
) as Record<TestDifficulty, number>;

/**
 * A mixed set: unsolved problems first (to do, then attempted), solved ones only to fill up,
 * taken in turn from each domain (or from each skill, when `domain` narrows the set to one
 * domain) so a set is never ten of one kind, and returned easy to hard.
 */
export function testMixedSetIds(
  problems: readonly TestHomeProblem[],
  statuses: ReadonlyMap<string, MasteryState>,
  {
    size = TEST_MIXED_SET_SIZE,
    domain,
    random = Math.random,
  }: { size?: number; domain?: string; random?: () => number } = {},
): string[] {
  const rank: Record<StatusBucket, number> = { todo: 0, attempted: 1, solved: 2 };
  const keyed = problems
    .filter((problem) => domain === undefined || problem.domain === domain)
    .map((problem) => ({
      problem,
      rank: rank[bucketOf(statuses.get(problem.id) ?? 'unseen')],
      shuffle: random(),
    }))
    .sort((a, b) => a.rank - b.rank || a.shuffle - b.shuffle);
  const spreadBy = (problem: TestHomeProblem) =>
    domain === undefined ? problem.domain : problem.skill;

  const picked: TestHomeProblem[] = [];
  const fill = (pool: typeof keyed) => {
    const queues = new Map<string, TestHomeProblem[]>();
    for (const { problem } of pool) {
      const key = spreadBy(problem);
      const list = queues.get(key) ?? [];
      list.push(problem);
      queues.set(key, list);
    }
    const lists = [...queues.values()];
    while (picked.length < size && lists.some((list) => list.length > 0)) {
      for (const list of lists) {
        const next = list.shift();
        if (next) picked.push(next);
        if (picked.length >= size) break;
      }
    }
  };
  fill(keyed.filter((entry) => entry.rank < 2));
  fill(keyed.filter((entry) => entry.rank === 2));
  return picked
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.id.localeCompare(b.id),
    )
    .map((problem) => problem.id);
}
