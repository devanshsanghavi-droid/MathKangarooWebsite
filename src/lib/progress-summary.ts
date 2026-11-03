import { POINT_VALUES, type Points } from './schemas';
import type { MasteryState } from './mastery';
import { attemptsFor, problemProgress, type ProgressFile } from './local-progress';

/**
 * Whole-bank progress, for the dashboard above the problem list.
 *
 * This is the part of "gamified" that docs/05 §8 does NOT rule out. That section rejects
 * energy points and badges, on the grounds that extrinsic rewards drift away from
 * understanding the maths, and CLAUDE.md puts leaderboards out of scope outright. What is
 * left - and what actually keeps people working - is being able to see where you are:
 * how much of each tier you have cleared, how many skills you have touched, whether you
 * practised yesterday. None of that invents a currency.
 *
 * Pure functions over the stored progress file, so every number here is testable without a
 * browser and means the same thing on the server as in the client.
 */

export interface TierProgress {
  points: Points;
  total: number;
  solved: number;
  attempted: number;
  /** 0-1. Solved over total. */
  share: number;
}

export interface BankProgress {
  problems: number;
  solved: number;
  attempted: number;
  untouched: number;
  byTier: TierProgress[];
  skillsTouched: number;
  skillsTotal: number;
  /** Consecutive days up to and including today (or yesterday) with at least one attempt. */
  streakDays: number;
  /** Distinct days with at least one attempt, ever. */
  activeDays: number;
}

/** The UTC calendar day an attempt falls on. Matches calendarDay in mastery.ts. */
function dayOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function shiftDay(day: string, deltaDays: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Every distinct day the student attempted anything, newest first.
 * Exported because the streak rule is easier to trust when its input is visible.
 */
export function activeDaysOf(file: ProgressFile): string[] {
  const days = new Set<string>();
  for (const attempts of Object.values(file.attempts)) {
    for (const attempt of attempts) days.add(dayOf(attempt.at));
  }
  return [...days].sort((a, b) => b.localeCompare(a));
}

/**
 * Consecutive practice days ending today or yesterday.
 *
 * Yesterday counts so the streak does not appear to break at midnight for someone who simply
 * has not opened the site yet today. It breaks on the first fully missed day after that.
 */
export function streakFrom(days: readonly string[], today: string): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** How far a single problem has got, from the attempts stored against any of its skills. */
export function statusOfProblem(
  file: ProgressFile,
  problemId: string,
  skillIds: readonly string[],
): MasteryState {
  const mine = skillIds
    .flatMap((skillId) => attemptsFor(file, skillId))
    .filter((attempt) => attempt.problemId === problemId);
  // The same attempt is stored against every skill the problem teaches, so deduplicate on
  // the timestamp before judging - otherwise a three-skill problem looks like three tries.
  const seen = new Set<string>();
  const unique = mine.filter((attempt) => {
    if (seen.has(attempt.at)) return false;
    seen.add(attempt.at);
    return true;
  });
  return problemProgress(unique);
}

export function bankProgress(
  file: ProgressFile,
  problems: ReadonlyArray<{ id: string; points: Points; skillIds: readonly string[] }>,
  skillsTotal: number,
  today: string,
): BankProgress {
  const statuses = problems.map((problem) => ({
    points: problem.points,
    status: statusOfProblem(file, problem.id, problem.skillIds),
  }));

  const solved = statuses.filter((s) => s.status === 'mastered' || s.status === 'shaky').length;
  const attempted = statuses.filter((s) => s.status === 'seen').length;

  const byTier = POINT_VALUES.map((points) => {
    const tier = statuses.filter((s) => s.points === points);
    const tierSolved = tier.filter((s) => s.status === 'mastered' || s.status === 'shaky').length;
    return {
      points,
      total: tier.length,
      solved: tierSolved,
      attempted: tier.filter((s) => s.status === 'seen').length,
      share: tier.length === 0 ? 0 : tierSolved / tier.length,
    };
  });

  const days = activeDaysOf(file);

  return {
    problems: problems.length,
    solved,
    attempted,
    untouched: problems.length - solved - attempted,
    byTier,
    skillsTouched: Object.keys(file.attempts).length,
    skillsTotal,
    streakDays: streakFrom(days, today),
    activeDays: days.length,
  };
}
