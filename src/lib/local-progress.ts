import {
  computeMastery,
  type AttemptRecord,
  type MasteryResult,
  type MasteryState,
} from './mastery';
import { resolveMasteryState } from './mastery-display';
import type { Points } from './schemas';

/**
 * Progress for a student who has not signed in — which, per CLAUDE.md, is every student who
 * has not chosen to. Practice never requires an account, so the mastery bar on a unit page
 * has to work with nothing but the browser.
 *
 * It is deliberately the SAME state machine the server will use once accounts exist:
 * `computeMastery` from mastery.ts, fed the same AttemptRecord shape. A signed-out student's
 * mastery and a signed-in student's mastery are then the same computation over the same data,
 * and the only difference is where the attempts live.
 *
 * What is stored: problem id, point value, right or wrong, hints used, and a timestamp.
 * Nothing else. No name, no identifier, nothing that leaves this browser — there is no
 * network call anywhere in this file, and that is a COPPA constraint, not a preference.
 *
 * Every read and write is wrapped: Safari private browsing throws on localStorage access, and
 * a student in a locked-down school browser should get a working page with an empty bar
 * rather than a crash.
 */

export const PROGRESS_KEY = 'ka-progress';
const VERSION = 1;

/** Keeps one skill's history from growing without bound in a browser that never clears. */
export const MAX_ATTEMPTS_PER_SKILL = 60;

export interface ProgressFile {
  version: number;
  /** skill id -> attempts on problems tagged with that skill, oldest first. */
  attempts: Record<string, AttemptRecord[]>;
}

export const EMPTY_PROGRESS: ProgressFile = { version: VERSION, attempts: {} };

function isAttempt(value: unknown): value is AttemptRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.problemId === 'string' &&
    typeof record.correct === 'boolean' &&
    typeof record.at === 'string' &&
    (record.points === 3 || record.points === 4 || record.points === 5) &&
    typeof record.hintsUsed === 'number'
  );
}

/** Parses whatever is in storage, discarding anything that does not match the shape. */
export function parseProgress(raw: string | null): ProgressFile {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_PROGRESS;
    const file = parsed as Partial<ProgressFile>;
    if (file.version !== VERSION || typeof file.attempts !== 'object' || file.attempts === null) {
      return EMPTY_PROGRESS;
    }
    const attempts: Record<string, AttemptRecord[]> = {};
    for (const [skillId, list] of Object.entries(file.attempts)) {
      if (!Array.isArray(list)) continue;
      const clean = list.filter(isAttempt);
      if (clean.length > 0) attempts[skillId] = clean.slice(-MAX_ATTEMPTS_PER_SKILL);
    }
    return { version: VERSION, attempts };
  } catch {
    // Corrupt JSON is treated as "no progress yet". Throwing here would break every page that
    // renders a mastery bar, which is most of them.
    return EMPTY_PROGRESS;
  }
}

export function readProgress(): ProgressFile {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function writeProgress(file: ProgressFile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(file));
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    // Storage full or blocked. The attempt is lost, which is the correct failure: we do not
    // fall back to a cookie or to the network.
  }
}

/** Fired on `window` after any write, so open mastery bars re-read without a reload. */
export const PROGRESS_EVENT = 'ka:progress';

/**
 * Records one attempt against every skill the problem is tagged with — primary and secondary.
 * A problem that exercises three skills is evidence about all three.
 */
export function recordAttempt(
  skillIds: readonly string[],
  attempt: AttemptRecord,
  file: ProgressFile = readProgress(),
): ProgressFile {
  const attempts = { ...file.attempts };
  for (const skillId of skillIds) {
    const existing = attempts[skillId] ?? [];
    attempts[skillId] = [...existing, attempt].slice(-MAX_ATTEMPTS_PER_SKILL);
  }
  return { version: VERSION, attempts };
}

export function saveAttempt(skillIds: readonly string[], attempt: AttemptRecord): ProgressFile {
  const next = recordAttempt(skillIds, attempt);
  writeProgress(next);
  return next;
}

export function attemptsFor(file: ProgressFile, skillId: string): readonly AttemptRecord[] {
  return file.attempts[skillId] ?? [];
}

export function masteryFor(file: ProgressFile, skillId: string, now: Date): MasteryResult {
  return computeMastery({ attempts: attemptsFor(file, skillId), now });
}

/**
 * The mastery state to SHOW for a skill. Resolved through `resolveMasteryState`, so a student
 * whose only attempt was wrong is not told they are Proficient. Use `masteryFor` when you want
 * the raw state machine result and its reasons.
 */
export function masteryStateFor(file: ProgressFile, skillId: string, now: Date): MasteryState {
  const attempts = attemptsFor(file, skillId);
  return resolveMasteryState(
    masteryFor(file, skillId, now).state,
    attempts.some((attempt) => attempt.correct),
  );
}

/**
 * Attempts on the problems of one ladder, in order. The exercise view needs the trailing run
 * to decide whether the ladder is finished; the unit page needs the count to draw the bar.
 */
export function ladderAttempts(
  file: ProgressFile,
  skillId: string,
  points: Points,
): readonly AttemptRecord[] {
  return attemptsFor(file, skillId).filter((attempt) => attempt.points === points);
}

export function clearProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    /* nothing we can do, and nothing that needs saying */
  }
}

/**
 * How far a student has got on ONE problem, expressed in the same four-step vocabulary the
 * skill-level state machine uses so the mastery bar and the mastery dot can share a legend.
 *
 * This is deliberately not `computeMastery` applied to a single problem: that bar asks for
 * three correct answers across two days, which no single problem is meant to carry. The
 * question here is narrower — did you get it, and did you get it cleanly?
 *
 *   unseen    never attempted
 *   seen      attempted, never yet correct
 *   shaky     correct, but only after a wrong answer or with a hint past the nudge
 *   mastered  correct with at most the nudge, and no wrong answer before it
 */
export function problemProgress(attempts: readonly AttemptRecord[]): MasteryState {
  if (attempts.length === 0) return 'unseen';
  const firstCorrect = attempts.findIndex((attempt) => attempt.correct);
  if (firstCorrect === -1) return 'seen';
  const clean = firstCorrect === 0 && (attempts[firstCorrect]?.hintsUsed ?? 0) <= 1;
  return clean ? 'mastered' : 'shaky';
}

/** Per-problem progress for a whole skill, in the order the problems were given. */
export function skillProblemProgress(
  file: ProgressFile,
  skillId: string,
  problemIds: readonly string[],
): Array<{ problemId: string; state: MasteryState }> {
  const all = attemptsFor(file, skillId);
  return problemIds.map((problemId) => ({
    problemId,
    state: problemProgress(all.filter((attempt) => attempt.problemId === problemId)),
  }));
}
