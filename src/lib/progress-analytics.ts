import { isAmcProblemId } from './amc-tier';
import {
  isTestProgressKey,
  type ProgressFile,
  type SessionExam,
  type SessionRecord,
} from './local-progress';

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
