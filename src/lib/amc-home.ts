import type { MasteryState } from './mastery';
import { bucketOf, type StatusBucket } from './progress-summary';
import type { AmcContest, AmcFormulaContest } from './amc-schemas';

/**
 * Pure helpers for the AMC beta landing (/amc): which problems belong on the chosen paper,
 * and the "Start a mixed set" picker. Browser-safe (type imports only, plus progress-summary).
 */

export interface AmcHomeProblem {
  id: string;
  slot: number;
  contest: AmcContest;
  area: string;
  topic: string;
}

export const MIXED_SET_SIZE = 10;

export function onPaper(problem: { contest: AmcContest }, paper: AmcFormulaContest): boolean {
  return problem.contest === 'BOTH' || problem.contest === paper;
}

/**
 * A mixed set for one paper: unsolved problems first (to do, then attempted), solved ones
 * only to fill up, spread across the areas in turn so a set is never ten algebra problems, and returned in
 * paper order (lowest slot first) so it climbs the way a real paper does.
 */
export function mixedSetIds(
  problems: readonly AmcHomeProblem[],
  statuses: ReadonlyMap<string, MasteryState>,
  paper: AmcFormulaContest,
  size = MIXED_SET_SIZE,
  random: () => number = Math.random,
): string[] {
  const rank: Record<StatusBucket, number> = { todo: 0, attempted: 1, solved: 2 };
  const keyed = problems
    .filter((problem) => onPaper(problem, paper))
    .map((problem) => ({
      problem,
      rank: rank[bucketOf(statuses.get(problem.id) ?? 'unseen')],
      shuffle: random(),
    }))
    .sort((a, b) => a.rank - b.rank || a.shuffle - b.shuffle);

  // Round robin over the areas, first over the problems not yet solved, and only then, if the
  // paper has fewer than `size` of those left, over the solved ones.
  const picked: AmcHomeProblem[] = [];
  const fill = (pool: typeof keyed) => {
    const byArea = new Map<string, AmcHomeProblem[]>();
    for (const { problem } of pool) {
      const list = byArea.get(problem.area) ?? [];
      list.push(problem);
      byArea.set(problem.area, list);
    }
    const queues = [...byArea.values()];
    while (picked.length < size && queues.some((queue) => queue.length > 0)) {
      for (const queue of queues) {
        const next = queue.shift();
        if (next) picked.push(next);
        if (picked.length >= size) break;
      }
    }
  };
  fill(keyed.filter((entry) => entry.rank < 2));
  fill(keyed.filter((entry) => entry.rank === 2));
  return picked.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id)).map((p) => p.id);
}
