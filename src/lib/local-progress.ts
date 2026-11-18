import {
  computeMastery,
  type AttemptRecord,
  type MasteryResult,
  type MasteryState,
} from './mastery';
import { resolveMasteryState } from './mastery-display';
import type { Points } from './schemas';
import { amcPointsOf, isAmcProblemId } from './amc-tier';
import {
  TEST_SLUG,
  testOfProblemId,
  testPointsOf,
  type StdTest,
  type TestDifficulty,
} from './test-meta';

/**
 * Progress for a student who has not signed in - which, per CLAUDE.md, is every student who
 * has not chosen to. Practice never requires an account, so the mastery bar on a unit page
 * has to work with nothing but the browser.
 *
 * It is deliberately the SAME state machine the server will use once accounts exist:
 * `computeMastery` from mastery.ts, fed the same AttemptRecord shape. A signed-out student's
 * mastery and a signed-in student's mastery are then the same computation over the same data,
 * and the only difference is where the attempts live.
 *
 * What is stored: problem id, point value, right or wrong, hints used, and a timestamp.
 * Nothing else. No name, no identifier, nothing that leaves this browser - there is no
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
  /**
   * Finished mock and section tests, oldest first, newest MAX_SESSIONS kept (docs/07 section
   * 5). Optional so every older file, and every writer that predates it, stays valid.
   */
  sessions?: SessionRecord[];
}

/* -------------------------------------------------------------------------- */
/* Test sessions (docs/07 section 5)                                           */
/* -------------------------------------------------------------------------- */

export const SESSION_KINDS = ['mock', 'section'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_EXAMS = ['KA', 'AMC8', 'AMC10', 'AMC12', 'SAT', 'ACT'] as const;
export type SessionExam = (typeof SESSION_EXAMS)[number];

/** Newest sessions kept, in the browser and in the synced copy. */
export const MAX_SESSIONS = 100;

/**
 * One finished mock or section test. Scores only: the questions answered in it are ALSO
 * recorded as ordinary attempts, so mastery never has to read this.
 *
 *   section   strand / area / domain id the section test covered; absent for a full mock.
 *   at        ISO timestamp the test was finished. With kind and exam it identifies the
 *             session when two devices merge (progress-sync.ts).
 *   score     in the exam's own scoring (AMC 10/12 6 / 1.5 / 0, otherwise 1 per correct).
 *   max       the best possible score.
 */
export interface SessionRecord {
  kind: SessionKind;
  exam: SessionExam;
  section?: string;
  at: string;
  score: number;
  max: number;
  correct: number;
  total: number;
  durationMs: number;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Validates one untrusted session and returns a copy holding only the known fields (strings
 * capped), or null. Shared with progress-sync.ts so an upload cannot smuggle extra fields in.
 */
export function cleanSession(value: unknown): SessionRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!(SESSION_KINDS as readonly unknown[]).includes(r.kind)) return null;
  if (!(SESSION_EXAMS as readonly unknown[]).includes(r.exam)) return null;
  if (typeof r.at !== 'string' || r.at.length === 0 || Number.isNaN(Date.parse(r.at))) {
    return null;
  }
  if (r.section != null && (typeof r.section !== 'string' || r.section.length === 0)) {
    return null;
  }
  if (!finite(r.score) || !finite(r.max)) return null;
  if (!finite(r.correct) || !finite(r.total) || !finite(r.durationMs)) return null;
  if (!Number.isInteger(r.correct) || !Number.isInteger(r.total) || r.correct > r.total) {
    return null;
  }
  const session: SessionRecord = {
    kind: r.kind as SessionKind,
    exam: r.exam as SessionExam,
    at: r.at.slice(0, 40),
    score: r.score,
    max: r.max,
    correct: r.correct,
    total: r.total,
    durationMs: Math.round(r.durationMs),
  };
  if (typeof r.section === 'string') session.section = r.section.slice(0, 32);
  return session;
}

/** The identity two devices agree on: kind, exam and finish time. */
export function sessionKey(session: Pick<SessionRecord, 'kind' | 'exam' | 'at'>): string {
  return `${session.kind}|${session.exam}|${session.at}`;
}

/** Oldest first, deduplicated by sessionKey (first copy wins), newest MAX_SESSIONS kept. */
export function normalizeSessions(sessions: readonly SessionRecord[]): SessionRecord[] {
  const byKey = new Map<string, SessionRecord>();
  for (const session of sessions) {
    const key = sessionKey(session);
    if (!byKey.has(key)) byKey.set(key, session);
  }
  return [...byKey.values()]
    .sort((a, b) =>
      a.at === b.at ? sessionKey(a).localeCompare(sessionKey(b)) : a.at < b.at ? -1 : 1,
    )
    .slice(-MAX_SESSIONS);
}

/** The file with `sessions` set, or the key left out entirely when there are none. */
function withSessions(
  version: number,
  attempts: ProgressFile['attempts'],
  sessions: readonly SessionRecord[] | undefined,
): ProgressFile {
  return sessions && sessions.length > 0
    ? { version, attempts, sessions: [...sessions] }
    : { version, attempts };
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
    const sessions = Array.isArray(file.sessions)
      ? normalizeSessions(
          (file.sessions as unknown[])
            .map(cleanSession)
            .filter((s): s is SessionRecord => s !== null),
        )
      : undefined;
    return withSessions(VERSION, attempts, sessions);
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
 * Records one attempt against every skill the problem is tagged with - primary and secondary.
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
  // Keep the sessions: a plain attempt must never drop the test history.
  return withSessions(VERSION, attempts, file.sessions);
}

export function saveAttempt(skillIds: readonly string[], attempt: AttemptRecord): ProgressFile {
  const next = recordAttempt(skillIds, attempt);
  writeProgress(next);
  return next;
}

/* -------------------------------------------------------------------------- */
/* AMC beta attempts                                                           */
/* -------------------------------------------------------------------------- */

/**
 * AMC attempts live in the SAME `ka-progress` file, in the same AttemptRecord shape, but each
 * one is bucketed under the AM problem id itself rather than under skill ids.
 *
 * Why not bucket by topic, the way Kangaroo buckets by skill? AMC topic ids share their shape
 * with Kangaroo skill ids (GEO-01 is both a Kangaroo skill and an AMC topic), so topic buckets
 * would silently mix the two banks' mastery. AM ids cannot collide with anything, keep the
 * store flat, and make per-problem status a single lookup. Topic, area and type progress are
 * derived on the page by grouping problems, which the page has to load anyway.
 *
 * `points` is 3 / 4 / 5 from the slot tier (Early / Middle / Late, see amc-tier.ts), so every
 * existing reader of the file (streaks, active days, parseProgress) keeps working unchanged.
 * Kangaroo readers that look up skill ids never see these buckets.
 */
export function amcProgressKey(problemId: string): string {
  if (!isAmcProblemId(problemId)) throw new RangeError(`not an AMC problem id: ${problemId}`);
  return problemId;
}

export interface AmcAttemptInput {
  correct: boolean;
  hintsUsed: number;
  /** ISO timestamp. */
  at: string;
}

export function recordAmcAttempt(
  problemId: string,
  slot: number,
  input: AmcAttemptInput,
  file: ProgressFile = readProgress(),
): ProgressFile {
  const attempt: AttemptRecord = { problemId, points: amcPointsOf(slot), ...input };
  return recordAttempt([amcProgressKey(problemId)], attempt, file);
}

export function saveAmcAttempt(
  problemId: string,
  slot: number,
  input: AmcAttemptInput,
): ProgressFile {
  const next = recordAmcAttempt(problemId, slot, input);
  writeProgress(next);
  return next;
}

/** Every attempt at one AMC problem, oldest first. */
export function amcAttemptsFor(file: ProgressFile, problemId: string): readonly AttemptRecord[] {
  return file.attempts[problemId] ?? [];
}

/* -------------------------------------------------------------------------- */
/* SAT / ACT attempts (docs/07 sections 3 and 5)                               */
/* -------------------------------------------------------------------------- */

/**
 * SAT and ACT attempts live in the same file and AttemptRecord shape as AMC ones, one bucket
 * per problem, under `sat:SA-0001` / `act:AC-0001`. The prefix is the namespace docs/07 asks
 * for: no Kangaroo skill id, AMC id or bare problem id can ever look like it, so mastery code
 * that reads skill buckets never sees these. Domain and skill progress are derived on the page
 * by grouping problems, as for AMC.
 *
 * `points` is 3 / 4 / 5 from the difficulty (easy / medium / hard, see test-meta.ts).
 */
export function testProgressKey(problemId: string): string {
  const test = testOfProblemId(problemId);
  if (!test) throw new RangeError(`not a SAT or ACT problem id: ${problemId}`);
  return `${TEST_SLUG[test]}:${problemId}`;
}

/** True for a `sat:` / `act:` bucket key. */
export function isTestProgressKey(key: string): boolean {
  return /^(sat:SA|act:AC)-\d{4}$/.test(key);
}

export interface TestAttemptInput {
  correct: boolean;
  hintsUsed: number;
  /** ISO timestamp. */
  at: string;
}

export function recordTestAttempt(
  problemId: string,
  difficulty: TestDifficulty,
  input: TestAttemptInput,
  file: ProgressFile = readProgress(),
): ProgressFile {
  const attempt: AttemptRecord = { problemId, points: testPointsOf(difficulty), ...input };
  return recordAttempt([testProgressKey(problemId)], attempt, file);
}

export function saveTestAttempt(
  problemId: string,
  difficulty: TestDifficulty,
  input: TestAttemptInput,
): ProgressFile {
  const next = recordTestAttempt(problemId, difficulty, input);
  writeProgress(next);
  return next;
}

/** Every attempt at one SAT or ACT problem, oldest first. */
export function testAttemptsFor(file: ProgressFile, problemId: string): readonly AttemptRecord[] {
  return file.attempts[testProgressKey(problemId)] ?? [];
}

/** Every SAT or ACT bucket for one test: problem id -> attempts, oldest first. */
export function testAttemptsByProblem(
  file: ProgressFile,
  test: StdTest,
): Map<string, readonly AttemptRecord[]> {
  const prefix = `${TEST_SLUG[test]}:`;
  const out = new Map<string, readonly AttemptRecord[]>();
  for (const [key, list] of Object.entries(file.attempts)) {
    if (key.startsWith(prefix) && isTestProgressKey(key)) out.set(key.slice(prefix.length), list);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Recording sessions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Appends one finished mock or section test. Invalid input is dropped (returns the file
 * unchanged) rather than thrown: losing one score line beats crashing the report screen.
 */
export function recordSession(
  session: SessionRecord,
  file: ProgressFile = readProgress(),
): ProgressFile {
  const clean = cleanSession(session);
  if (!clean) return file;
  return withSessions(
    file.version,
    file.attempts,
    normalizeSessions([...(file.sessions ?? []), clean]),
  );
}

export function saveSession(session: SessionRecord): ProgressFile {
  const next = recordSession(session);
  writeProgress(next);
  return next;
}

/** Sessions oldest first, optionally narrowed to one exam and / or kind. */
export function sessionsOf(
  file: ProgressFile,
  filter: { exam?: SessionExam; kind?: SessionKind } = {},
): readonly SessionRecord[] {
  return (file.sessions ?? []).filter(
    (s) =>
      (filter.exam === undefined || s.exam === filter.exam) &&
      (filter.kind === undefined || s.kind === filter.kind),
  );
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
 * question here is narrower - did you get it, and did you get it cleanly?
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
