import type { Problem } from './schemas';

/**
 * Problem of the Day.
 *
 * Deterministic from the date, with no database and no cron: every visitor on a given day gets
 * the same problem, and the same date always resolves to the same one. The full `/potd` page
 * with its 6pm reveal and its archive is P2; this is the card `docs/00-SPEC.md` §1.1 asks the
 * home page for, and it works today.
 *
 * The hash is deliberately trivial - this needs to be stable and readable, not unpredictable.
 */
export function dayNumber(date: Date): number {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor(utc / 86_400_000);
}

export function problemOfTheDay(problems: readonly Problem[], date: Date): Problem | undefined {
  if (problems.length === 0) return undefined;
  // Sorted by id upstream, so the sequence is stable as the bank grows at the end.
  return problems[dayNumber(date) % problems.length];
}

/** e.g. "Thursday 28 August 2026", in the reader's own words rather than an ISO stamp. */
export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
