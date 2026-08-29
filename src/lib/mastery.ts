import type { Points } from './schemas';

/**
 * The mastery state machine from `docs/01-DATA-MODEL.md` §3.1.
 *
 *   unseen   - no attempt on any problem in this skill
 *   seen     - at least one attempt
 *   shaky    - accuracy below 70% over the last five, or a 4/5-point miss after a 3-point solve
 *   mastered - three consecutive correct, across at least two calendar days, with no hint
 *              above level 1
 *
 * Mastery decays to shaky once the FSRS due date is more than 14 days past.
 *
 * Everything here is a pure function of a student's attempts on ONE skill. Nothing reads a
 * database, nothing reads the clock except through the `now` you pass in, and state is always
 * recomputed from the attempts rather than advanced incrementally - a stored state that drifts
 * away from the attempts that produced it is a bug nobody ever notices.
 */

export const MASTERY_STATES = ['unseen', 'seen', 'shaky', 'mastered'] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

/** Consecutive correct answers needed, and the number of distinct days they must span. */
export const MASTERY_STREAK = 3;
export const MASTERY_DISTINCT_DAYS = 2;
/** A hint above this level means the answer was not really the student's own. */
export const MASTERY_MAX_HINT = 1;
/** Accuracy over the most recent attempts, below which a skill is shaky. */
export const SHAKY_WINDOW = 5;
export const SHAKY_ACCURACY = 0.7;
/** How long a skill may sit past its due date before mastery lapses. */
export const DECAY_DAYS = 14;

export interface AttemptRecord {
  problemId: string;
  points: Points;
  correct: boolean;
  /** 0 to 3. Level 1 is the nudge, which gives nothing away. */
  hintsUsed: number;
  /** ISO timestamp. */
  at: string;
}

export interface MasteryResult {
  state: MasteryState;
  /** Trailing run of correct answers, however long. */
  streak: number;
  /** Why the state is what it is, in the order the rules were applied. */
  reasons: string[];
}

/** The UTC calendar day an attempt falls on, so "two distinct days" is well defined. */
export function calendarDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function chronological(attempts: readonly AttemptRecord[]): AttemptRecord[] {
  return [...attempts].sort(
    (a, b) => a.at.localeCompare(b.at) || a.problemId.localeCompare(b.problemId),
  );
}

export function trailingStreak(attempts: readonly AttemptRecord[]): number {
  let streak = 0;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index]?.correct) break;
    streak += 1;
  }
  return streak;
}

/**
 * Three consecutive correct, on at least two distinct days, none of them leaning on a hint
 * above the nudge. All three conditions apply to the SAME three attempts - a student cannot
 * combine a clean run from March with a two-day spread from April.
 */
export function meetsMasteryBar(attempts: readonly AttemptRecord[]): boolean {
  if (attempts.length < MASTERY_STREAK) return false;
  const last = attempts.slice(-MASTERY_STREAK);
  if (!last.every((attempt) => attempt.correct)) return false;
  if (!last.every((attempt) => attempt.hintsUsed <= MASTERY_MAX_HINT)) return false;
  const days = new Set(last.map((attempt) => calendarDay(attempt.at)));
  return days.size >= MASTERY_DISTINCT_DAYS;
}

/** Accuracy over the most recent attempts, or null when there are none. */
export function recentAccuracy(
  attempts: readonly AttemptRecord[],
  window = SHAKY_WINDOW,
): number | null {
  if (attempts.length === 0) return null;
  const recent = attempts.slice(-window);
  return recent.filter((attempt) => attempt.correct).length / recent.length;
}

/**
 * A miss at 4 or 5 points that came after a 3-point solve in the same skill. It says the
 * student has the idea but not the version of it the exam actually asks for, which is a
 * different problem from not knowing the skill at all.
 */
export function hasHigherTierMiss(attempts: readonly AttemptRecord[]): boolean {
  let solvedThreePointer = false;
  for (const attempt of attempts) {
    if (attempt.correct && attempt.points === 3) solvedThreePointer = true;
    else if (!attempt.correct && attempt.points > 3 && solvedThreePointer) return true;
  }
  return false;
}

/** Days past the due date, or null when there is no due date. Negative means not yet due. */
export function daysOverdue(due: string | null | undefined, now: Date): number | null {
  if (!due) return null;
  return (now.getTime() - new Date(due).getTime()) / 86_400_000;
}

export function computeMastery({
  attempts,
  due,
  now,
}: {
  attempts: readonly AttemptRecord[];
  due?: string | null;
  now: Date;
}): MasteryResult {
  const ordered = chronological(attempts);
  const streak = trailingStreak(ordered);
  const reasons: string[] = [];

  if (ordered.length === 0) {
    return { state: 'unseen', streak: 0, reasons: ['no attempt on any problem in this skill'] };
  }

  if (meetsMasteryBar(ordered)) {
    const overdue = daysOverdue(due, now);
    if (overdue !== null && overdue > DECAY_DAYS) {
      reasons.push(
        `mastery bar met, but the review is ${Math.floor(overdue)} days overdue (limit ${DECAY_DAYS})`,
      );
      return { state: 'shaky', streak, reasons };
    }
    reasons.push(
      `${MASTERY_STREAK} consecutive correct across at least ${MASTERY_DISTINCT_DAYS} days, no hint above level ${MASTERY_MAX_HINT}`,
    );
    return { state: 'mastered', streak, reasons };
  }

  // Mastered is checked first on purpose: a fresh clean run outranks older failures still
  // sitting inside the five-attempt window. See the note in STATUS.md.
  const accuracy = recentAccuracy(ordered);
  if (accuracy !== null && accuracy < SHAKY_ACCURACY) {
    reasons.push(
      `accuracy ${Math.round(accuracy * 100)}% over the last ${Math.min(ordered.length, SHAKY_WINDOW)} is below ${SHAKY_ACCURACY * 100}%`,
    );
    return { state: 'shaky', streak, reasons };
  }

  if (hasHigherTierMiss(ordered)) {
    reasons.push('a 4- or 5-point miss followed a 3-point solve in this skill');
    return { state: 'shaky', streak, reasons };
  }

  reasons.push(`${ordered.length} attempt${ordered.length === 1 ? '' : 's'}, no bar met yet`);
  return { state: 'seen', streak, reasons };
}

/** Ordering for "the three weakest skills" on the dashboard: worst first. */
export const MASTERY_RANK: Record<MasteryState, number> = {
  shaky: 0,
  seen: 1,
  unseen: 2,
  mastered: 3,
};

export function isWeaker(a: MasteryState, b: MasteryState): boolean {
  return MASTERY_RANK[a] < MASTERY_RANK[b];
}
