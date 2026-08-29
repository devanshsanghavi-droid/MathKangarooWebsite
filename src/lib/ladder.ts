import { trailingStreak, type AttemptRecord } from './mastery';

/**
 * One rung of a skill's practice ladder: every problem in the skill at one point value.
 *
 * docs/05-DESIGN-DIRECTION.md §7.3 — "3 in a row to finish this ladder". The bar is a trailing
 * run of three correct answers on this rung, which is the same shape as the mastery streak in
 * mastery.ts but scoped to one tier: a student who can do three 3-pointers in a row has
 * finished the 3-point ladder, whatever their 5-point record looks like.
 *
 * Everything here is pure. The runner owns which problem is on screen; this owns what the
 * stored attempts mean.
 */

export const LADDER_TARGET = 3;

export interface LadderState {
  /** Trailing run of correct answers on this rung. */
  streak: number;
  complete: boolean;
  /** Distinct problems on this rung the student has ever got right. */
  solved: number;
  total: number;
  /**
   * Index of the problem to open on arrival: the first one never yet solved, or the first
   * problem if they have all been solved. Never null — a finished ladder can still be redone.
   */
  startIndex: number;
}

export function ladderState(
  problemIds: readonly string[],
  attempts: readonly AttemptRecord[],
): LadderState {
  const streak = trailingStreak(attempts);
  const solvedIds = new Set(
    attempts.filter((attempt) => attempt.correct).map((attempt) => attempt.problemId),
  );
  const firstUnsolved = problemIds.findIndex((id) => !solvedIds.has(id));

  return {
    streak,
    complete: streak >= LADDER_TARGET && problemIds.length > 0,
    solved: problemIds.filter((id) => solvedIds.has(id)).length,
    total: problemIds.length,
    startIndex: firstUnsolved === -1 ? 0 : firstUnsolved,
  };
}

/**
 * The streak dots along the top of the exercise view. Always LADDER_TARGET of them, filled
 * from the left — a progress display a student can read at a glance without counting.
 */
export function streakDots(streak: number): Array<'filled' | 'empty'> {
  return Array.from({ length: LADDER_TARGET }, (_unused, index) =>
    index < Math.min(streak, LADDER_TARGET) ? 'filled' : 'empty',
  );
}

/** Wraps, so "Next problem" on the last rung goes back to the first rather than dead-ending. */
export function advance(index: number, total: number): number {
  if (total === 0) return 0;
  return (index + 1) % total;
}
