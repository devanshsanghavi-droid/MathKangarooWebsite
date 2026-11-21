import { isAmcProblemId } from './amc-tier';
import { mockHref, sectionTestHref as engineSectionHref } from './exam-engine';
import { LIVE_EXAM_IDS, examById, topicName, type LiveExamId } from './exams';
import {
  SESSION_EXAMS,
  isTestProgressKey,
  type AttemptMode,
  type ProgressFile,
  type SessionExam,
  type SessionRecord,
} from './local-progress';
import { PRACTICE_SET_URL_MAX, practiceSetHref, type PracticeBank } from './practice-item';

/**
 * The numbers behind /progress (docs/07 section 5): accuracy by section, what needs practice,
 * how the last twelve weeks went, and the test history.
 *
 * Pure functions over the progress file and a small build-time description of each bank, so
 * every figure on the page is testable without a browser. Nothing here ranks a student against
 * anyone else, counts a streak, or awards anything: it only reads the student's own answers.
 *
 * How the four banks store attempts (local-progress.ts):
 *
 *   Kangaroo  one bucket per skill; an attempt is stored under every skill its problem is tagged
 *             with, so the same answer appears in several buckets and is deduplicated here.
 *   AMC       one bucket per problem, under the bare AM id.
 *   SAT, ACT  one bucket per problem, under `sat:SA-0001` / `act:AC-0001`.
 *
 * Every attempt counts, retries included: accuracy is right answers over answers given.
 */

export const PROGRESS_BANKS = ['KA', 'AMC', 'SAT', 'ACT'] as const;
export type ProgressBank = (typeof PROGRESS_BANKS)[number];

export const PROGRESS_BANK_LABEL: Readonly<Record<ProgressBank, string>> = {
  KA: 'Kangaroo',
  AMC: 'AMC',
  SAT: 'SAT',
  ACT: 'ACT',
};

/** What a bank calls its sections and their parts, for headings. */
export const PROGRESS_SECTION_NOUN: Readonly<
  Record<ProgressBank, { section: string; sub: string }>
> = {
  KA: { section: 'strand', sub: 'skill' },
  AMC: { section: 'area', sub: 'topic' },
  SAT: { section: 'domain', sub: 'skill' },
  ACT: { section: 'domain', sub: 'skill' },
};

/** Session exams that belong to each bank tab. */
export const BANK_EXAMS: Readonly<Record<ProgressBank, readonly SessionExam[]>> = {
  KA: ['KA'],
  AMC: ['AMC8', 'AMC10', 'AMC12'],
  SAT: ['SAT'],
  ACT: ['ACT'],
};

/** Where a full mock for each bank lives. */
export const BANK_MOCK_HREF: Readonly<Record<ProgressBank, string>> = {
  KA: '/practice/mock',
  AMC: '/amc/mock',
  SAT: '/sat/mock',
  ACT: '/act/mock',
};

/* -------------------------------------------------------------------------- */
/* The build-time description of a bank                                        */
/* -------------------------------------------------------------------------- */

export interface BankSection {
  /** Strand, area or domain id. */
  id: string;
  name: string;
  /** Skills or topics, in display order. */
  subs: Array<{ id: string; name: string }>;
}

/**
 * Problem ids that share a sub (topic / skill) and a meta value, written once each. This is
 * the compact form sent to the page.
 *
 *   sub    AMC topic or SAT/ACT skill. null for Kangaroo, whose skills come from the buckets.
 *   meta   Kangaroo band (for the section-test level) or AMC contest; null for SAT/ACT.
 */
export interface ProblemGroup {
  sub: string | null;
  meta: string | null;
  ids: string[];
}

export interface BankSpec {
  bank: ProgressBank;
  sections: BankSection[];
  groups: ProblemGroup[];
}

/* -------------------------------------------------------------------------- */
/* Answers                                                                     */
/* -------------------------------------------------------------------------- */

/** One answer, after deduplication, with the subs it counts towards. */
export interface AnswerEvent {
  problemId: string;
  correct: boolean;
  at: string;
  subs: string[];
  meta: string | null;
  /** docs/08 item 9: time on the question, when it was timed. */
  ms?: number;
  /** docs/08 item 9: practice or test; older attempts have neither. */
  mode?: AttemptMode;
}

function problemLookup(spec: BankSpec): Map<string, { sub: string | null; meta: string | null }> {
  const out = new Map<string, { sub: string | null; meta: string | null }>();
  for (const group of spec.groups) {
    for (const id of group.ids) out.set(id, { sub: group.sub, meta: group.meta });
  }
  return out;
}

function isBucketOf(bank: ProgressBank, key: string, kaSkills: ReadonlySet<string>): boolean {
  switch (bank) {
    case 'KA':
      return kaSkills.has(key);
    case 'AMC':
      return isAmcProblemId(key);
    case 'SAT':
      return key.startsWith('sat:') && isTestProgressKey(key);
    case 'ACT':
      return key.startsWith('act:') && isTestProgressKey(key);
  }
}

/** Every answer the student gave in one bank, oldest first. */
export function bankEvents(file: ProgressFile, spec: BankSpec): AnswerEvent[] {
  const lookup = problemLookup(spec);
  const kaSkills = new Set(spec.sections.flatMap((s) => s.subs.map((sub) => sub.id)));
  const byKey = new Map<string, AnswerEvent>();

  for (const [key, attempts] of Object.entries(file.attempts)) {
    if (!isBucketOf(spec.bank, key, kaSkills)) continue;
    for (const attempt of attempts) {
      const id = `${attempt.problemId}|${attempt.at}`;
      const known = lookup.get(attempt.problemId);
      let event = byKey.get(id);
      if (!event) {
        event = {
          problemId: attempt.problemId,
          correct: attempt.correct,
          at: attempt.at,
          subs: [],
          meta: known?.meta ?? null,
        };
        if (attempt.ms !== undefined) event.ms = attempt.ms;
        if (attempt.mode !== undefined) event.mode = attempt.mode;
        byKey.set(id, event);
      }
      // Kangaroo: the bucket IS the skill. Elsewhere the problem's own topic / skill.
      const sub = spec.bank === 'KA' ? key : (known?.sub ?? null);
      if (sub !== null && !event.subs.includes(sub)) event.subs.push(sub);
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.problemId.localeCompare(b.problemId),
  );
}

/* -------------------------------------------------------------------------- */
/* By section                                                                  */
/* -------------------------------------------------------------------------- */

export interface Tally {
  attempts: number;
  correct: number;
  /** 0-1, or null with no attempts. */
  accuracy: number | null;
}

export interface SubStat extends Tally {
  id: string;
  name: string;
}

export interface SectionStat extends Tally {
  id: string;
  name: string;
  subs: SubStat[];
  /** The band (Kangaroo) or contest (AMC) the student answered most in this section. */
  meta: string | null;
}

function tally(events: readonly AnswerEvent[]): Tally {
  const correct = events.filter((e) => e.correct).length;
  return {
    attempts: events.length,
    correct,
    accuracy: events.length === 0 ? null : correct / events.length,
  };
}

function mostCommon(values: ReadonlyArray<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Every section in taxonomy order, each with its subs, tried or not. */
export function sectionStats(events: readonly AnswerEvent[], spec: BankSpec): SectionStat[] {
  return spec.sections.map((section) => {
    const subIds = new Set(section.subs.map((s) => s.id));
    const mine = events.filter((e) => e.subs.some((sub) => subIds.has(sub)));
    return {
      id: section.id,
      name: section.name,
      ...tally(mine),
      meta: mostCommon(mine.map((e) => e.meta)),
      subs: section.subs.map((sub) => ({
        id: sub.id,
        name: sub.name,
        ...tally(mine.filter((e) => e.subs.includes(sub.id))),
      })),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Needs practice                                                              */
/* -------------------------------------------------------------------------- */

/** Fewer answers than this says too little about a section to call it weak. */
export const NEEDS_PRACTICE_MIN_ATTEMPTS = 5;
/** At most this many, and at least NEEDS_PRACTICE_FLOOR when that many qualify. */
export const NEEDS_PRACTICE_MAX = 5;
export const NEEDS_PRACTICE_FLOOR = 3;
/** Past the floor, a section is only listed while its accuracy is under this. */
export const NEEDS_PRACTICE_BELOW = 0.8;

/**
 * The weakest sections with enough evidence: at least NEEDS_PRACTICE_MIN_ATTEMPTS answers,
 * lowest accuracy first (more answers first on a tie). The weakest three are always listed
 * when there are three to list; up to five while they stay under 80%. A section answered
 * perfectly is never called weak.
 */
export function needsPractice(stats: readonly SectionStat[]): SectionStat[] {
  const eligible = stats
    .filter((s) => s.attempts >= NEEDS_PRACTICE_MIN_ATTEMPTS && (s.accuracy ?? 1) < 1)
    .sort(
      (a, b) =>
        (a.accuracy ?? 1) - (b.accuracy ?? 1) ||
        b.attempts - a.attempts ||
        a.id.localeCompare(b.id),
    );
  const out: SectionStat[] = [];
  for (const stat of eligible) {
    if (out.length >= NEEDS_PRACTICE_MAX) break;
    if (out.length >= NEEDS_PRACTICE_FLOOR && (stat.accuracy ?? 1) >= NEEDS_PRACTICE_BELOW) break;
    out.push(stat);
  }
  return out;
}

/**
 * The section-test link for one section. The section-test routes agree on these params:
 *
 *   Kangaroo  /practice/section?level=<band>&strand=<STRAND>   e.g. level=5-6&strand=GEO
 *   AMC       /amc/section?contest=<AMC8|AMC10|AMC12>&area=<AREA>
 *   SAT       /sat/section?domain=<DOMAIN>
 *   ACT       /act/section?domain=<DOMAIN>
 *
 * `level` and `contest` come from where the student answered most in that section (a problem
 * tagged BOTH counts as AMC 10) and are left out when unknown, so the route can ask.
 */
export function sectionTestHref(bank: ProgressBank, section: Pick<SectionStat, 'id' | 'meta'>) {
  const params = new URLSearchParams();
  switch (bank) {
    case 'KA':
      if (section.meta) params.set('level', section.meta);
      params.set('strand', section.id);
      return `/practice/section?${params.toString()}`;
    case 'AMC':
      if (section.meta) params.set('contest', section.meta === 'BOTH' ? 'AMC10' : section.meta);
      params.set('area', section.id);
      return `/amc/section?${params.toString()}`;
    case 'SAT':
    case 'ACT':
      params.set('domain', section.id);
      return `/${bank === 'SAT' ? 'sat' : 'act'}/section?${params.toString()}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Over time                                                                   */
/* -------------------------------------------------------------------------- */

export const WEEKS_SHOWN = 12;

export interface WeekStat extends Tally {
  /** The Monday the week starts on, in the student's local calendar, YYYY-MM-DD. */
  start: string;
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local midnight on the Monday of the week holding `date`. */
export function mondayOf(date: Date): Date {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/**
 * The last `weeks` weeks, oldest first, ending with the week holding `now`. Weeks run Monday
 * to Sunday in the student's own time zone. A week with no answers has accuracy null, so a
 * chart can leave a gap rather than drawing a zero the student never scored.
 */
export function weeklyStats(
  events: readonly AnswerEvent[],
  now: Date,
  weeks = WEEKS_SHOWN,
): WeekStat[] {
  const thisMonday = mondayOf(now);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - 7 * i);
    starts.push(ymd(d));
  }
  const byWeek = new Map<string, AnswerEvent[]>(starts.map((s) => [s, []]));
  for (const event of events) {
    const when = new Date(event.at);
    if (Number.isNaN(when.getTime())) continue;
    byWeek.get(ymd(mondayOf(when)))?.push(event);
  }
  return starts.map((start) => ({ start, ...tally(byWeek.get(start) ?? []) }));
}

/** Each side of a trend needs this many answers before it is worth comparing. */
export const TREND_MIN_ATTEMPTS = 5;
export const TREND_WEEKS = 4;

export interface Trend {
  earlier: Tally;
  recent: Tally;
  /** Recent minus earlier accuracy, or null when either side has too few answers. */
  change: number | null;
}

/**
 * Accuracy over the last four weeks against the four before. Plain description, no verdict:
 * the page says "up from 62% to 74%" and leaves it there.
 */
export function trendOf(weeks: readonly WeekStat[]): Trend {
  const sum = (list: readonly WeekStat[]): Tally => {
    const attempts = list.reduce((n, w) => n + w.attempts, 0);
    const correct = list.reduce((n, w) => n + w.correct, 0);
    return { attempts, correct, accuracy: attempts === 0 ? null : correct / attempts };
  };
  const recent = sum(weeks.slice(-TREND_WEEKS));
  const earlier = sum(weeks.slice(-2 * TREND_WEEKS, -TREND_WEEKS));
  const comparable =
    recent.attempts >= TREND_MIN_ATTEMPTS &&
    earlier.attempts >= TREND_MIN_ATTEMPTS &&
    recent.accuracy !== null &&
    earlier.accuracy !== null;
  return {
    earlier,
    recent,
    change: comparable ? (recent.accuracy ?? 0) - (earlier.accuracy ?? 0) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Test history and the whole bank                                             */
/* -------------------------------------------------------------------------- */

/** This bank's finished mocks and section tests, newest first. */
export function bankSessions(file: ProgressFile, bank: ProgressBank): SessionRecord[] {
  const exams = BANK_EXAMS[bank];
  return (file.sessions ?? [])
    .filter((s) => exams.includes(s.exam))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface BankSummary extends Tally {
  bank: ProgressBank;
  sectionsTried: number;
  sections: SectionStat[];
  needsPractice: SectionStat[];
  weeks: WeekStat[];
  sessions: SessionRecord[];
  /** Any answer or finished test: whether the tab is enabled. */
  active: boolean;
}

export function bankSummary(file: ProgressFile, spec: BankSpec, now: Date): BankSummary {
  const events = bankEvents(file, spec);
  const sections = sectionStats(events, spec);
  const sessions = bankSessions(file, spec.bank);
  return {
    bank: spec.bank,
    ...tally(events),
    sectionsTried: sections.filter((s) => s.attempts > 0).length,
    sections,
    needsPractice: needsPractice(sections),
    weeks: weeklyStats(events, now),
    sessions,
    active: events.length > 0 || sessions.length > 0,
  };
}

/** "73%", or "-" when there is nothing to show. */
export function percentLabel(accuracy: number | null): string {
  return accuracy === null ? '-' : `${Math.round(accuracy * 100)}%`;
}

/* -------------------------------------------------------------------------- */
/* docs/08 item 8: one exam or all of them                                     */
/* -------------------------------------------------------------------------- */

/** The /progress exam filter: every exam, or one live catalog exam. */
export const EXAM_FILTERS = ['all', ...LIVE_EXAM_IDS] as const;
export type ExamFilter = (typeof EXAM_FILTERS)[number];

/** `?exam=` from the URL, falling back to all exams for anything unknown. */
export function parseExamFilter(value: string | null | undefined): ExamFilter {
  return (EXAM_FILTERS as readonly string[]).includes(value ?? '') ? (value as ExamFilter) : 'all';
}

/** The bank that stores each live exam's answers. */
export const EXAM_BANK: Readonly<Record<LiveExamId, ProgressBank>> = {
  ka: 'KA',
  amc8: 'AMC',
  amc10: 'AMC',
  amc12: 'AMC',
  sat: 'SAT',
  act: 'ACT',
};

/** The bank each session exam belongs to. */
export const SESSION_BANK: Readonly<Record<SessionExam, ProgressBank>> = {
  KA: 'KA',
  AMC8: 'AMC',
  AMC10: 'AMC',
  AMC12: 'AMC',
  SAT: 'SAT',
  ACT: 'ACT',
};

/** Short names for session exams, matching the catalog's shortName. */
export const SESSION_EXAM_LABEL: Readonly<Record<SessionExam, string>> = {
  KA: 'Kangaroo',
  AMC8: 'AMC 8',
  AMC10: 'AMC 10',
  AMC12: 'AMC 12',
  SAT: 'SAT',
  ACT: 'ACT',
};

/**
 * Whether one answer counts for the filter. AMC answers are split by the problem's contest
 * tag; a problem tagged BOTH belongs to the AMC 10 and the AMC 12, as in the AMC bank.
 */
export function answerInExam(filter: ExamFilter, bank: ProgressBank, meta: string | null): boolean {
  if (filter === 'all') return true;
  if (EXAM_BANK[filter] !== bank) return false;
  if (bank !== 'AMC') return true;
  if (filter === 'amc8') return meta === 'AMC8';
  if (filter === 'amc10') return meta === 'AMC10' || meta === 'BOTH';
  return meta === 'AMC12' || meta === 'BOTH';
}

/** One answer with the bank it came from. */
export interface ExamAnswer extends AnswerEvent {
  bank: ProgressBank;
}

/** Every answer for the filter across the banks given, oldest first. */
export function examAnswers(
  file: ProgressFile,
  specs: readonly BankSpec[],
  filter: ExamFilter,
): ExamAnswer[] {
  const out: ExamAnswer[] = [];
  for (const spec of specs) {
    if (filter !== 'all' && EXAM_BANK[filter] !== spec.bank) continue;
    for (const event of bankEvents(file, spec)) {
      if (answerInExam(filter, spec.bank, event.meta)) out.push({ ...event, bank: spec.bank });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at) || a.problemId.localeCompare(b.problemId));
}

export function sessionInExam(filter: ExamFilter, session: Pick<SessionRecord, 'exam'>): boolean {
  return filter === 'all' || examById(filter)?.sessionExam === session.exam;
}

/** Finished mocks and section tests for the filter, newest first. */
export function examSessions(file: ProgressFile, filter: ExamFilter): SessionRecord[] {
  return (file.sessions ?? [])
    .filter((s) => sessionInExam(filter, s))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Answers and tests per filter, so the filter can disable an exam with nothing in it. */
export function examFilterCounts(
  file: ProgressFile,
  specs: readonly BankSpec[],
): Record<ExamFilter, { answers: number; tests: number }> {
  const out = {} as Record<ExamFilter, { answers: number; tests: number }>;
  for (const filter of EXAM_FILTERS) {
    out[filter] = {
      answers: examAnswers(file, specs, filter).length,
      tests: examSessions(file, filter).length,
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Key stats                                                                   */
/* -------------------------------------------------------------------------- */

export const DAY_MS = 86_400_000;
/** The "recent" window for accuracy comparisons. */
export const RECENT_DAYS = 14;

function talliedOf(events: ReadonlyArray<Pick<AnswerEvent, 'correct'>>): Tally {
  const correct = events.filter((e) => e.correct).length;
  return {
    attempts: events.length,
    correct,
    accuracy: events.length === 0 ? null : correct / events.length,
  };
}

export interface PeriodComparison {
  recent: Tally;
  earlier: Tally;
  /** Recent minus earlier accuracy, or null when either side has under TREND_MIN_ATTEMPTS. */
  change: number | null;
}

/**
 * Accuracy over the last `days` days against the `earlierDays` before them (or everything
 * before them when `earlierDays` is null). Each side needs TREND_MIN_ATTEMPTS answers.
 */
export function compareRecent(
  events: ReadonlyArray<Pick<AnswerEvent, 'at' | 'correct'>>,
  now: Date,
  days = RECENT_DAYS,
  earlierDays: number | null = days,
): PeriodComparison {
  const end = now.getTime();
  const split = end - days * DAY_MS;
  const start = earlierDays === null ? -Infinity : split - earlierDays * DAY_MS;
  const recent: Array<Pick<AnswerEvent, 'correct'>> = [];
  const earlier: Array<Pick<AnswerEvent, 'correct'>> = [];
  for (const event of events) {
    const t = Date.parse(event.at);
    if (Number.isNaN(t) || t > end) continue;
    if (t > split) recent.push(event);
    else if (t > start) earlier.push(event);
  }
  const r = talliedOf(recent);
  const e = talliedOf(earlier);
  const comparable =
    r.attempts >= TREND_MIN_ATTEMPTS &&
    e.attempts >= TREND_MIN_ATTEMPTS &&
    r.accuracy !== null &&
    e.accuracy !== null;
  return {
    recent: r,
    earlier: e,
    change: comparable ? (r.accuracy ?? 0) - (e.accuracy ?? 0) : null,
  };
}

/** Practice answers only: an attempt without a mode predates timing and was practice. */
export function practiceAnswers<T extends Pick<AnswerEvent, 'mode'>>(events: readonly T[]): T[] {
  return events.filter((e) => e.mode !== 'test');
}

/** Tests compared once there are at least this many... */
export const TEST_COMPARE_MIN = 4;
/** ...averaging this many at each end. */
export const TEST_COMPARE_COUNT = 3;

export interface TestComparison {
  taken: number;
  /** Average score as a share of the top score, first and last TEST_COMPARE_COUNT tests. */
  first: number | null;
  last: number | null;
  change: number | null;
}

/** A session's score as a share of its top score (0-1), or null with no top score. */
export function scoreRatio(session: Pick<SessionRecord, 'score' | 'max'>): number | null {
  return session.max > 0 ? Math.min(1, Math.max(0, session.score / session.max)) : null;
}

/**
 * The average of the last three tests against the first three, each as a share of its top
 * score so a mock and a section test can sit side by side. Needs four tests.
 */
export function compareTests(sessions: readonly SessionRecord[]): TestComparison {
  const ratios = [...sessions]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(scoreRatio)
    .filter((r): r is number => r !== null);
  if (ratios.length < TEST_COMPARE_MIN) {
    return { taken: sessions.length, first: null, last: null, change: null };
  }
  const mean = (list: number[]) => list.reduce((n, r) => n + r, 0) / list.length;
  const first = mean(ratios.slice(0, TEST_COMPARE_COUNT));
  const last = mean(ratios.slice(-TEST_COMPARE_COUNT));
  return { taken: sessions.length, first, last, change: last - first };
}

/** Answers in all, and in the week (Monday to Sunday, local) holding `now`. */
export function answeredCounts(
  events: ReadonlyArray<Pick<AnswerEvent, 'at'>>,
  now: Date,
): { total: number; thisWeek: number } {
  const monday = mondayOf(now).getTime();
  const end = now.getTime();
  let thisWeek = 0;
  for (const event of events) {
    const t = Date.parse(event.at);
    if (t >= monday && t <= end) thisWeek += 1;
  }
  return { total: events.length, thisWeek };
}

export interface TimeStat {
  /** Answers that carry a time. */
  timed: number;
  totalMs: number;
  /** Mean time per timed answer, or null when none is timed. */
  averageMs: number | null;
}

/** Time on questions, from the answers that were timed (docs/08 item 9). */
export function timeStats(events: ReadonlyArray<Pick<AnswerEvent, 'ms'>>): TimeStat {
  let timed = 0;
  let totalMs = 0;
  for (const event of events) {
    if (typeof event.ms !== 'number') continue;
    timed += 1;
    totalMs += event.ms;
  }
  return { timed, totalMs, averageMs: timed === 0 ? null : totalMs / timed };
}

/* -------------------------------------------------------------------------- */
/* Strengths and weak spots                                                    */
/* -------------------------------------------------------------------------- */

/** Under this accuracy a topic is tagged "Needs work"; at or over STRONG_FROM, "Strong". */
export const NEEDS_WORK_BELOW = 0.6;
export const STRONG_FROM = 0.8;

export type TopicTag = 'needs-work' | 'strong' | null;

export const TOPIC_TAG_LABEL: Readonly<Record<'needs-work' | 'strong', string>> = {
  'needs-work': 'Needs work',
  strong: 'Strong',
};

/** A tag needs NEEDS_PRACTICE_MIN_ATTEMPTS answers: two answers say little about a topic. */
export function topicTag(tally: Tally): TopicTag {
  if (tally.accuracy === null || tally.attempts < NEEDS_PRACTICE_MIN_ATTEMPTS) return null;
  if (tally.accuracy < NEEDS_WORK_BELOW) return 'needs-work';
  if (tally.accuracy >= STRONG_FROM) return 'strong';
  return null;
}

export interface TopicRow extends Tally {
  bank: ProgressBank;
  /** Section (strand / area / domain) id. */
  id: string;
  /** The exam's name for it when one exam is chosen, else the bank taxonomy name. */
  name: string;
  /** For the section-test link: Kangaroo band or AMC contest. */
  meta: string | null;
  averageMs: number | null;
  /** The last 14 days against everything before. */
  trend: PeriodComparison;
  tag: TopicTag;
}

/**
 * One row per section answered in, weakest first (more answers first on a tie). With one
 * exam chosen the names follow that exam (topicName), and an AMC row's section test is that
 * exam's contest.
 */
export function topicRows(
  answers: readonly ExamAnswer[],
  specs: readonly BankSpec[],
  filter: ExamFilter,
  now: Date,
): TopicRow[] {
  const exam = filter === 'all' ? undefined : examById(filter);
  const rows: TopicRow[] = [];
  for (const spec of specs) {
    if (filter !== 'all' && EXAM_BANK[filter] !== spec.bank) continue;
    const mine = answers.filter((a) => a.bank === spec.bank);
    for (const section of spec.sections) {
      const subIds = new Set(section.subs.map((s) => s.id));
      const events = mine.filter((e) => e.subs.some((sub) => subIds.has(sub)));
      if (events.length === 0) continue;
      const counts = talliedOf(events);
      const meta =
        spec.bank === 'AMC' && exam?.sessionExam
          ? exam.sessionExam
          : mostCommon(events.map((e) => e.meta));
      rows.push({
        bank: spec.bank,
        id: section.id,
        name: exam ? topicName(exam, section.id, section.name) : section.name,
        meta,
        ...counts,
        averageMs: timeStats(events).averageMs,
        trend: compareRecent(events, now, RECENT_DAYS, null),
        tag: topicTag(counts),
      });
    }
  }
  return rows.sort(
    (a, b) =>
      (a.accuracy ?? 1) - (b.accuracy ?? 1) ||
      b.attempts - a.attempts ||
      a.bank.localeCompare(b.bank) ||
      a.id.localeCompare(b.id),
  );
}

/** The topic to work on next: the weakest with enough answers, if it is under STRONG_FROM. */
export function focusTopic(rows: readonly TopicRow[]): TopicRow | null {
  const eligible = rows.filter(
    (r) =>
      r.attempts >= NEEDS_PRACTICE_MIN_ATTEMPTS && r.accuracy !== null && r.accuracy < STRONG_FROM,
  );
  return eligible[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Activity calendar                                                           */
/* -------------------------------------------------------------------------- */

export interface DayActivity {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  attempts: number;
  correct: number;
  /** After `now`, in the current week: drawn blank, not as a day off. */
  future: boolean;
}

/**
 * Every day of the last `weeks` weeks, Monday first, oldest first, ending with the Sunday of
 * the week holding `now`: weeks x 7 entries, so a calendar can lay them out in columns.
 */
export function dailyActivity(
  events: ReadonlyArray<Pick<AnswerEvent, 'at' | 'correct'>>,
  now: Date,
  weeks = WEEKS_SHOWN,
): DayActivity[] {
  const first = mondayOf(now);
  first.setDate(first.getDate() - 7 * (weeks - 1));
  const today = ymd(now);
  const days: DayActivity[] = [];
  const byDate = new Map<string, DayActivity>();
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    const date = ymd(d);
    const day = { date, attempts: 0, correct: 0, future: date > today };
    days.push(day);
    byDate.set(date, day);
  }
  for (const event of events) {
    const when = new Date(event.at);
    if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) continue;
    const day = byDate.get(ymd(when));
    if (!day) continue;
    day.attempts += 1;
    if (event.correct) day.correct += 1;
  }
  return days;
}

/** 0 for no answers, else 1-4 in quarters of the busiest day. */
export function activityLevel(attempts: number, busiest: number): 0 | 1 | 2 | 3 | 4 {
  if (attempts <= 0 || busiest <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((4 * attempts) / busiest))) as 1 | 2 | 3 | 4;
}

/* -------------------------------------------------------------------------- */
/* Test scores over time and review                                            */
/* -------------------------------------------------------------------------- */

export interface ScorePoint {
  at: string;
  /** Score as a share of the top score, 0-1. */
  ratio: number;
  session: SessionRecord;
}

export interface ScoreSeries {
  exam: SessionExam;
  points: ScorePoint[];
}

/** One series per exam with a finished test, in catalog order, each oldest first. */
export function scoreSeries(sessions: readonly SessionRecord[]): ScoreSeries[] {
  return SESSION_EXAMS.map((exam) => ({
    exam,
    points: sessions
      .filter((s) => s.exam === exam)
      .flatMap((session) => {
        const ratio = scoreRatio(session);
        return ratio === null ? [] : [{ at: session.at, ratio, session }];
      })
      .sort((a, b) => a.at.localeCompare(b.at)),
  })).filter((series) => series.points.length > 0);
}

/** Test answers are stamped with the finish time; this much slack covers clock rounding. */
export const REVIEW_WINDOW_MS = 2 * 60_000;

const BANK_ID_PREFIX: Readonly<Record<ProgressBank, string>> = {
  KA: 'KA-',
  AMC: 'AM-',
  SAT: 'SA-',
  ACT: 'AC-',
};

const PRACTICE_BANK: Readonly<Record<ProgressBank, PracticeBank>> = {
  KA: 'ka',
  AMC: 'amc',
  SAT: 'sat',
  ACT: 'act',
};

/**
 * The questions answered in one finished test. Sessions store scores only, but the test's
 * answers were saved as attempts with mode 'test' stamped at the finish time, so they can be
 * found again. Empty for a test taken before attempts carried a mode.
 */
export function sessionReviewIds(file: ProgressFile, session: SessionRecord): string[] {
  const finished = Date.parse(session.at);
  if (Number.isNaN(finished)) return [];
  const prefix = BANK_ID_PREFIX[SESSION_BANK[session.exam]];
  const ids = new Set<string>();
  for (const attempts of Object.values(file.attempts)) {
    for (const attempt of attempts) {
      if (attempt.mode !== 'test' || !attempt.problemId.startsWith(prefix)) continue;
      const t = Date.parse(attempt.at);
      if (Math.abs(t - finished) <= REVIEW_WINDOW_MS) ids.add(attempt.problemId);
    }
  }
  return [...ids].sort().slice(0, PRACTICE_SET_URL_MAX);
}

/** "AMC 8 mock" / "Kangaroo section test". */
export function sessionLabel(session: Pick<SessionRecord, 'exam' | 'kind'>): string {
  return `${SESSION_EXAM_LABEL[session.exam]} ${session.kind === 'mock' ? 'mock' : 'section test'}`;
}

/**
 * Where Review goes: a practice set of the test's own questions when they can be found, else
 * the same kind of test again (its section preselected), which is the honest fallback.
 */
export function sessionReview(
  file: ProgressFile,
  session: SessionRecord,
): { href: string; questions: number } {
  const ids = sessionReviewIds(file, session);
  if (ids.length > 0) {
    return {
      href: practiceSetHref({
        bank: PRACTICE_BANK[SESSION_BANK[session.exam]],
        ids,
        name: `Review: ${sessionLabel(session)}`,
      }),
      questions: ids.length,
    };
  }
  return {
    href:
      session.kind === 'section'
        ? engineSectionHref(session.exam, session.section ?? null)
        : mockHref(session.exam),
    questions: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* The plain-language summary                                                  */
/* -------------------------------------------------------------------------- */

export interface SummaryInput {
  answers: number;
  tests: TestComparison;
  practice: PeriodComparison;
  topics: readonly TopicRow[];
  /** Whether topic names need the bank alongside them (all exams). */
  qualify: boolean;
}

function points(change: number): number {
  return Math.round(change * 100);
}

function plainPercent(value: number | null): string {
  return value === null ? '-' : `${Math.round(value * 100)}%`;
}

/**
 * One or two plain sentences for the top of /progress, from the student's own numbers only.
 * Says nothing it cannot back: with too few tests or answers it says what is missing instead.
 */
export function progressSentence(input: SummaryInput): string {
  const { answers, tests, practice, topics, qualify } = input;
  if (answers === 0 && tests.taken === 0) return 'Nothing answered here yet.';
  const parts: string[] = [];

  if (tests.change !== null && tests.last !== null) {
    const p = points(tests.change);
    const avg = plainPercent(tests.last);
    parts.push(
      p > 0
        ? `Test scores have risen ${p} ${p === 1 ? 'point' : 'points'}: your last 3 tests averaged ${avg} of the top score.`
        : p < 0
          ? `Test scores have dipped ${-p} ${p === -1 ? 'point' : 'points'}: your last 3 tests averaged ${avg} of the top score.`
          : `Test scores have held steady: your last 3 tests averaged ${avg} of the top score.`,
    );
  } else if (tests.taken > 0) {
    parts.push(
      `You have finished ${tests.taken} ${tests.taken === 1 ? 'test' : 'tests'}; after ${TEST_COMPARE_MIN}, this compares your latest scores with your first.`,
    );
  }

  if (practice.change !== null) {
    const p = points(practice.change);
    const now = plainPercent(practice.recent.accuracy);
    const before = plainPercent(practice.earlier.accuracy);
    parts.push(
      p > 0
        ? `Practice accuracy is ${now} over the last ${RECENT_DAYS} days, up from ${before}.`
        : p < 0
          ? `Practice accuracy is ${now} over the last ${RECENT_DAYS} days, down from ${before}.`
          : `Practice accuracy is ${now} over the last ${RECENT_DAYS} days, the same as before.`,
    );
  } else if (practice.recent.attempts >= TREND_MIN_ATTEMPTS) {
    parts.push(
      `Practice accuracy is ${plainPercent(practice.recent.accuracy)} over the last ${RECENT_DAYS} days.`,
    );
  }

  if (parts.length === 0) {
    parts.push(`You have answered ${answers} ${answers === 1 ? 'question' : 'questions'} so far.`);
  }

  const focus = focusTopic(topics);
  if (focus) {
    const where = qualify ? ` in ${PROGRESS_BANK_LABEL[focus.bank]}` : '';
    parts.push(`Focus next on ${focus.name}${where} (${plainPercent(focus.accuracy)}).`);
  } else if (topics.some((t) => t.attempts >= NEEDS_PRACTICE_MIN_ATTEMPTS)) {
    parts.push(
      `Every topic with ${NEEDS_PRACTICE_MIN_ATTEMPTS} or more answers is at ${Math.round(STRONG_FROM * 100)}% or better.`,
    );
  } else {
    parts.push(
      `A topic needs ${NEEDS_PRACTICE_MIN_ATTEMPTS} answers before this can point at a weak spot.`,
    );
  }
  return parts.join(' ');
}
