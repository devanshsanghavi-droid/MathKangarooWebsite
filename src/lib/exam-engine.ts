import type { ChoiceKey } from './schemas';
import type { PracticeBank, PracticeItem } from './practice-item';
import type { SessionExam, SessionKind, SessionRecord } from './local-progress';

/**
 * The generic exam engine (docs/07 section 4): one set of pure rules for every timed sitting,
 * mock or section test, on every bank. The client runner (components/exam-runner) renders
 * whatever state these functions return and never decides a rule itself.
 *
 *   exam     the paper being imitated: KA, AMC8, AMC10, AMC12, SAT, ACT (the session ids)
 *   spec     how that paper scores, how many choices it has, how its mock is timed
 *   state    one sitting, as plain JSON, saved to localStorage after every change
 *
 * The clock is never counted down in memory. The state stores when the current module
 * started and the time left is computed from the wall clock, so a refresh at minute 40 comes
 * back at minute 40 and closing the laptop for ten minutes costs ten minutes, as in a hall.
 *
 * Pure, type imports only, so the unit tests and the browser share every line of it.
 */

export type ExamId = SessionExam;

/**
 * How a question scores. `flat` is per-question (AMC 10/12: 6 right, 1.5 blank, 0 wrong);
 * `points` scores a correct answer at the question's own point value (Kangaroo 3 / 4 / 5).
 */
export type ScoringRule =
  { kind: 'flat'; correct: number; blank: number; wrong: number } | { kind: 'points' };

export interface ExamModuleSpec {
  label: string;
  count: number;
  minutes: number;
}

export interface ExamSpec {
  exam: ExamId;
  /** "AMC 10", "SAT Math". */
  label: string;
  bank: PracticeBank;
  /** Choices per question, for the guessing arithmetic in the nudge and the report. */
  choiceCount: 4 | 5;
  scoring: ScoringRule;
  /** The full mock's modules, in order. Null for Kangaroo, whose mock lives at /practice/mock. */
  mock: readonly ExamModuleSpec[] | null;
  /** An approximate scaled score is shown for a full mock of these. */
  scale: 'sat' | 'act' | null;
  /** What one section of this bank is called: strand, area, domain, category. */
  sectionNoun: string;
}

const AMC_FLAT_10_12: ScoringRule = { kind: 'flat', correct: 6, blank: 1.5, wrong: 0 };
const ONE_PER_CORRECT: ScoringRule = { kind: 'flat', correct: 1, blank: 0, wrong: 0 };

/** docs/07 sections 2-4. Real formats, non-adaptive. */
export const EXAM_SPECS: Readonly<Record<ExamId, ExamSpec>> = {
  KA: {
    exam: 'KA',
    label: 'Math Kangaroo',
    bank: 'ka',
    choiceCount: 5,
    scoring: { kind: 'points' },
    mock: null,
    scale: null,
    sectionNoun: 'strand',
  },
  AMC8: {
    exam: 'AMC8',
    label: 'AMC 8',
    bank: 'amc',
    choiceCount: 5,
    scoring: ONE_PER_CORRECT,
    mock: [{ label: 'AMC 8', count: 25, minutes: 40 }],
    scale: null,
    sectionNoun: 'area',
  },
  AMC10: {
    exam: 'AMC10',
    label: 'AMC 10',
    bank: 'amc',
    choiceCount: 5,
    scoring: AMC_FLAT_10_12,
    mock: [{ label: 'AMC 10', count: 25, minutes: 75 }],
    scale: null,
    sectionNoun: 'area',
  },
  AMC12: {
    exam: 'AMC12',
    label: 'AMC 12',
    bank: 'amc',
    choiceCount: 5,
    scoring: AMC_FLAT_10_12,
    mock: [{ label: 'AMC 12', count: 25, minutes: 75 }],
    scale: null,
    sectionNoun: 'area',
  },
  SAT: {
    exam: 'SAT',
    label: 'SAT Math',
    bank: 'sat',
    choiceCount: 4,
    scoring: ONE_PER_CORRECT,
    mock: [
      { label: 'Module 1', count: 22, minutes: 35 },
      { label: 'Module 2', count: 22, minutes: 35 },
    ],
    scale: 'sat',
    sectionNoun: 'domain',
  },
  ACT: {
    exam: 'ACT',
    label: 'ACT Math',
    bank: 'act',
    choiceCount: 4,
    scoring: ONE_PER_CORRECT,
    mock: [{ label: 'ACT Math', count: 45, minutes: 50 }],
    scale: 'act',
    // The ACT calls its top-level sections reporting categories.
    sectionNoun: 'category',
  },
};

export function mockQuestionCount(spec: ExamSpec): number {
  return (spec.mock ?? []).reduce((sum, mod) => sum + mod.count, 0);
}

export function mockMinutes(spec: ExamSpec): number {
  return (spec.mock ?? []).reduce((sum, mod) => sum + mod.minutes, 0);
}

/** A section test's length. */
export const SECTION_TEST_SIZE = 10;
/** Fewer than this in a section and no test is offered: five questions say little enough. */
export const SECTION_TEST_MIN = 5;
/** The blank nudge appears when this much time is left in the current module. */
export const NUDGE_AT_MS = 5 * 60_000;

/** "12:05". Hours roll into minutes: a 75-minute paper starts at 75:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "12 minutes 5 seconds", for a timer's accessible name. */
export function spokenClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Sum of the questions' estimated seconds, rounded up to the minute (docs/07 section 4). */
export function sectionTestMinutes(estSeconds: readonly number[]): number {
  const total = estSeconds.reduce((sum, s) => sum + Math.max(0, s), 0);
  return Math.max(1, Math.ceil(total / 60));
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

export interface ExamAnswer {
  chosenKey: ChoiceKey | null;
  flagged: boolean;
  /** Milliseconds this question was on screen, across visits. */
  msSpent: number;
}

export interface ExamModuleState {
  label: string;
  /** Index into problemIds of the module's first question. */
  start: number;
  count: number;
  durationMs: number;
}

export const EXAM_STATE_VERSION = 1;

export interface ExamState {
  v: number;
  kind: SessionKind;
  exam: ExamId;
  /** strand / area / domain id of a section test; null for a mock. */
  section: string | null;
  /** "AMC 10 mock", "SAT Math section test: Algebra". */
  title: string;
  seed: number;
  problemIds: string[];
  /** Section id -> name, for the report. Saved with the run so a resumed report needs no lookup. */
  labels: Record<string, string>;
  modules: ExamModuleState[];
  moduleIndex: number;
  /** Wall-clock start of the current module. */
  moduleStartedAt: string;
  startedAt: string;
  finishedAt: string | null;
  answers: Record<string, ExamAnswer>;
  /** Index into problemIds of the question on screen. */
  current: number;
  /** Epoch ms when the current question came on screen, for msSpent. */
  enteredAt: number;
  /** The attempts and the session have been written to the progress file. */
  recorded: boolean;
}

export interface StartExamInput {
  kind: SessionKind;
  exam: ExamId;
  section?: string | null;
  title: string;
  seed: number;
  problemIds: readonly string[];
  modules: readonly ExamModuleSpec[];
  labels?: Record<string, string>;
  now: Date;
}

/** A fresh sitting. Throws if the modules do not add up to the paper: that is a caller bug. */
export function startExam(input: StartExamInput): ExamState {
  const total = input.modules.reduce((sum, mod) => sum + mod.count, 0);
  if (total !== input.problemIds.length || input.problemIds.length === 0) {
    throw new RangeError(
      `modules hold ${total} questions but the paper has ${input.problemIds.length}`,
    );
  }
  let start = 0;
  const modules = input.modules.map((mod) => {
    const out: ExamModuleState = {
      label: mod.label,
      start,
      count: mod.count,
      durationMs: Math.round(mod.minutes * 60_000),
    };
    start += mod.count;
    return out;
  });
  const at = input.now.toISOString();
  return {
    v: EXAM_STATE_VERSION,
    kind: input.kind,
    exam: input.exam,
    section: input.section ?? null,
    title: input.title,
    seed: input.seed,
    problemIds: [...input.problemIds],
    labels: { ...(input.labels ?? {}) },
    modules,
    moduleIndex: 0,
    moduleStartedAt: at,
    startedAt: at,
    finishedAt: null,
    answers: Object.fromEntries(
      input.problemIds.map((id) => [id, { chosenKey: null, flagged: false, msSpent: 0 }]),
    ),
    current: 0,
    enteredAt: input.now.getTime(),
    recorded: false,
  };
}

export function currentModule(state: ExamState): ExamModuleState {
  const mod = state.modules[state.moduleIndex] ?? state.modules[0];
  if (!mod) throw new RangeError('an exam has at least one module');
  return mod;
}

export function isLastModule(state: ExamState): boolean {
  return state.moduleIndex >= state.modules.length - 1;
}

/** Milliseconds left in the current module, floored at zero. */
export function remainingMs(state: ExamState, now: Date): number {
  if (state.finishedAt) return 0;
  const elapsed = now.getTime() - Date.parse(state.moduleStartedAt);
  return Math.max(0, currentModule(state).durationMs - elapsed);
}

function bankTime(state: ExamState, nowMs: number): Record<string, ExamAnswer> {
  const id = state.problemIds[state.current];
  const answer = id ? state.answers[id] : undefined;
  if (!id || !answer) return state.answers;
  const spent = Math.max(0, nowMs - state.enteredAt);
  return { ...state.answers, [id]: { ...answer, msSpent: answer.msSpent + spent } };
}

function enterModule(state: ExamState, index: number, startedAtMs: number): ExamState {
  const mod = state.modules[index];
  if (!mod) return state;
  return {
    ...state,
    answers: bankTime(state, startedAtMs),
    moduleIndex: index,
    moduleStartedAt: new Date(startedAtMs).toISOString(),
    current: mod.start,
    enteredAt: startedAtMs,
  };
}

/** Submit the whole exam now. */
export function finishExam(state: ExamState, now: Date): ExamState {
  if (state.finishedAt) return state;
  return {
    ...state,
    answers: bankTime(state, now.getTime()),
    finishedAt: now.toISOString(),
  };
}

/**
 * Submit the current module: the next one starts now, or the exam ends after the last. A
 * submitted module is closed, as on the real SAT: the navigator never goes back into it.
 */
export function submitModule(state: ExamState, now: Date): ExamState {
  if (state.finishedAt) return state;
  if (isLastModule(state)) return finishExam(state, now);
  return enterModule(state, state.moduleIndex + 1, now.getTime());
}

/**
 * Applies every expiry that has happened by `now`: a module whose time ran out closes and the
 * next starts at the moment it ran out (so time away keeps counting), and the last one running
 * out submits the exam. Returns the same object when nothing changed.
 */
export function syncClock(state: ExamState, now: Date): ExamState {
  let next = state;
  // Bounded by the module count, so a corrupt clock cannot spin.
  for (let guard = 0; guard <= state.modules.length; guard += 1) {
    if (next.finishedAt) return next;
    const endsAt = Date.parse(next.moduleStartedAt) + currentModule(next).durationMs;
    if (now.getTime() < endsAt) return next;
    if (isLastModule(next)) {
      return {
        ...next,
        answers: bankTime(next, Math.min(endsAt, now.getTime())),
        finishedAt: new Date(Math.min(endsAt, now.getTime())).toISOString(),
      };
    }
    next = enterModule(next, next.moduleIndex + 1, endsAt);
  }
  return next;
}

/** Move to a question inside the current module; anything outside it is clamped. */
export function goToQuestion(state: ExamState, index: number, now: Date): ExamState {
  if (state.finishedAt) return state;
  const mod = currentModule(state);
  const target = Math.min(mod.start + mod.count - 1, Math.max(mod.start, index));
  if (target === state.current) return state;
  return {
    ...state,
    answers: bankTime(state, now.getTime()),
    current: target,
    enteredAt: now.getTime(),
  };
}

function patchCurrent(state: ExamState, patch: (answer: ExamAnswer) => ExamAnswer): ExamState {
  if (state.finishedAt) return state;
  const id = state.problemIds[state.current];
  const answer = id ? state.answers[id] : undefined;
  if (!id || !answer) return state;
  return { ...state, answers: { ...state.answers, [id]: patch(answer) } };
}

/** Pick a choice for the question on screen. `clearAnswer` takes it back to blank. */
export function chooseAnswer(state: ExamState, key: ChoiceKey): ExamState {
  return patchCurrent(state, (answer) => ({ ...answer, chosenKey: key }));
}

export function clearAnswer(state: ExamState): ExamState {
  return patchCurrent(state, (answer) => ({ ...answer, chosenKey: null }));
}

export function toggleFlag(state: ExamState): ExamState {
  return patchCurrent(state, (answer) => ({ ...answer, flagged: !answer.flagged }));
}

/** Ids of the current module, in order. */
export function moduleIds(state: ExamState): string[] {
  const mod = currentModule(state);
  return state.problemIds.slice(mod.start, mod.start + mod.count);
}

export function countBlanks(state: ExamState, ids: readonly string[] = state.problemIds): number {
  return ids.filter((id) => (state.answers[id]?.chosenKey ?? null) === null).length;
}

export function countFlagged(state: ExamState, ids: readonly string[] = state.problemIds): number {
  return ids.filter((id) => state.answers[id]?.flagged === true).length;
}

/** Five minutes or less left in the module, and a question in it still blank. */
export function shouldNudge(state: ExamState, now: Date): boolean {
  if (state.finishedAt) return false;
  const left = remainingMs(state, now);
  return left > 0 && left <= NUDGE_AT_MS && countBlanks(state, moduleIds(state)) > 0;
}

/** Does a blank score anything? Decides whether the advice is "guess" or "guess with care". */
export function blankScores(spec: ExamSpec): boolean {
  return spec.scoring.kind === 'flat' && spec.scoring.blank > 0;
}

/**
 * The nudge's words. With no penalty, a blank is a sure zero and a guess is free. On AMC 10/12
 * a blank is worth 1.5 and a blind guess only 6/5 = 1.2 on average, so the advice changes: a
 * guess pays once two choices are ruled out (6/3 = 2).
 */
export function nudgeCopy(spec: ExamSpec, blanks: number): { title: string; body: string } {
  const title = `Five minutes left, and ${blanks} question${blanks === 1 ? ' is' : 's are'} blank.`;
  if (spec.scoring.kind === 'flat' && blankScores(spec)) {
    const { correct, blank } = spec.scoring;
    return {
      title,
      body:
        `A blank scores ${blank} and a wrong answer 0. A blind guess is worth only ` +
        `${round2(correct / spec.choiceCount)} on average, so guess only where you can rule ` +
        'out at least two choices.',
    };
  }
  return {
    title,
    body:
      'A wrong answer costs nothing here. A blank scores zero for certain; a guess scores zero ' +
      'or more. Fill every one of them before the end.',
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Scoring and the report                                                      */
/* -------------------------------------------------------------------------- */

/** What scoring and the report need to know about one question. */
export interface ExamItemFacts {
  id: string;
  correctKey: ChoiceKey | null;
  points: number;
  /** strand / area / domain id. */
  section: string;
  /** skill / topic id. */
  group: string;
  groupName: string;
}

/** The facts the report needs, read from a practice item of any bank. */
export function itemFacts(item: PracticeItem): ExamItemFacts {
  const correctKey = item.choices.find((choice) => choice.correct)?.key ?? null;
  const groupName = item.groups[0]?.name ?? '';
  if (item.bank === 'ka') {
    const skill = item.skillIds[0] ?? '';
    return {
      id: item.id,
      correctKey,
      points: item.points,
      section: skill.slice(0, 3),
      group: skill,
      groupName: groupName || skill,
    };
  }
  if (item.bank === 'amc') {
    return {
      id: item.id,
      correctKey,
      points: item.points,
      section: item.area,
      group: item.topic,
      groupName: groupName || item.topic,
    };
  }
  return {
    id: item.id,
    correctKey,
    points: item.points,
    section: item.domain,
    group: item.skill,
    groupName: groupName || item.skill,
  };
}

export type Outcome = 'correct' | 'wrong' | 'blank';

export interface QuestionResult {
  /** 0-based position in the paper. */
  index: number;
  id: string;
  chosenKey: ChoiceKey | null;
  correctKey: ChoiceKey | null;
  outcome: Outcome;
  scored: number;
  msSpent: number;
  section: string;
  group: string;
}

export interface GroupResult {
  id: string;
  name: string;
  asked: number;
  correct: number;
  blank: number;
}

export interface ScaleEstimate {
  kind: 'sat' | 'act';
  low: number;
  high: number;
  min: number;
  max: number;
}

export interface ExamReport {
  score: number;
  max: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  /** Approximate scaled score, full SAT / ACT mocks only. */
  scale: ScaleEstimate | null;
  /** Accuracy per strand / area / domain, in first-seen order. */
  sections: GroupResult[];
  /** Accuracy per skill / topic, in first-seen order. */
  groups: GroupResult[];
  questions: QuestionResult[];
  /**
   * Up to three places to work on, worst first. A mock ranks sections (each links to its
   * section test); a section test, already inside one section, ranks its skills or topics.
   */
  focus: GroupResult[];
  focusLevel: 'section' | 'group';
}

export function questionScore(rule: ScoringRule, outcome: Outcome, points: number): number {
  if (rule.kind === 'points') return outcome === 'correct' ? points : 0;
  return rule[outcome];
}

export function maxScoreOf(rule: ScoringRule, facts: readonly Pick<ExamItemFacts, 'points'>[]) {
  if (rule.kind === 'points') return facts.reduce((sum, f) => sum + f.points, 0);
  return facts.length * rule.correct;
}

/**
 * An APPROXIMATE scaled score, always shown as a range and labelled as an estimate. The real
 * conversion varies by form and is not published for these questions; a straight line from
 * the raw fraction is the honest version of "about here".
 */
export function estimateScale(kind: 'sat' | 'act', correct: number, total: number): ScaleEstimate {
  const p = total > 0 ? Math.min(1, Math.max(0, correct / total)) : 0;
  if (kind === 'sat') {
    const mid = Math.round((200 + 600 * p) / 10) * 10;
    return {
      kind,
      min: 200,
      max: 800,
      low: Math.max(200, mid - 30),
      high: Math.min(800, mid + 30),
    };
  }
  const mid = Math.round(1 + 35 * p);
  return { kind, min: 1, max: 36, low: Math.max(1, mid - 1), high: Math.min(36, mid + 1) };
}

function rankWorst(groups: readonly GroupResult[]): GroupResult[] {
  return [...groups]
    .filter((g) => g.correct < g.asked)
    .sort(
      (a, b) =>
        a.correct / a.asked - b.correct / b.asked || b.asked - a.asked || a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}

export function scoreExam(
  state: ExamState,
  spec: ExamSpec,
  facts: ReadonlyMap<string, ExamItemFacts>,
): ExamReport {
  const questions: QuestionResult[] = [];
  const sections = new Map<string, GroupResult>();
  const groups = new Map<string, GroupResult>();
  const scored: ExamItemFacts[] = [];
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  state.problemIds.forEach((id, index) => {
    const fact = facts.get(id);
    if (!fact) return;
    scored.push(fact);
    const answer = state.answers[id];
    const chosenKey = answer?.chosenKey ?? null;
    const outcome: Outcome =
      chosenKey === null ? 'blank' : chosenKey === fact.correctKey ? 'correct' : 'wrong';
    const points = questionScore(spec.scoring, outcome, fact.points);
    score += points;
    if (outcome === 'correct') correct += 1;
    else if (outcome === 'wrong') wrong += 1;
    else blank += 1;
    questions.push({
      index,
      id,
      chosenKey,
      correctKey: fact.correctKey,
      outcome,
      scored: points,
      msSpent: answer?.msSpent ?? 0,
      section: fact.section,
      group: fact.group,
    });
    const tally = (map: Map<string, GroupResult>, key: string, name: string) => {
      const entry = map.get(key) ?? { id: key, name, asked: 0, correct: 0, blank: 0 };
      entry.asked += 1;
      if (outcome === 'correct') entry.correct += 1;
      if (outcome === 'blank') entry.blank += 1;
      map.set(key, entry);
    };
    tally(sections, fact.section, state.labels[fact.section] ?? fact.section);
    tally(groups, fact.group, fact.groupName);
  });

  const total = questions.length;
  const fullMock =
    state.kind === 'mock' && spec.scale !== null && total === mockQuestionCount(spec);
  const sectionList = [...sections.values()];
  const groupList = [...groups.values()];
  const focusLevel = state.kind === 'mock' ? 'section' : 'group';

  return {
    score: round2(score),
    max: maxScoreOf(spec.scoring, scored),
    correct,
    wrong,
    blank,
    total,
    scale: fullMock && spec.scale ? estimateScale(spec.scale, correct, total) : null,
    sections: sectionList,
    groups: groupList,
    questions,
    focus: rankWorst(focusLevel === 'section' ? sectionList : groupList),
    focusLevel,
  };
}

/** The progress-file line for a finished sitting (docs/07 section 5). */
export function toSessionRecord(state: ExamState, report: ExamReport): SessionRecord | null {
  if (!state.finishedAt) return null;
  const record: SessionRecord = {
    kind: state.kind,
    exam: state.exam,
    at: state.finishedAt,
    score: report.score,
    max: report.max,
    correct: report.correct,
    total: report.total,
    durationMs: Math.max(0, Date.parse(state.finishedAt) - Date.parse(state.startedAt)),
  };
  if (state.section) record.section = state.section;
  return record;
}

/* -------------------------------------------------------------------------- */
/* Links                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where a section test for this exam and section starts, with the section preselected. The
 * progress page's "Practice this" and the report's "work on" list both link here.
 *
 *   KA     /practice/section?level=3-4&strand=GEO   (level optional)
 *   AMC    /amc/section?contest=AMC10&area=ALG
 *   SAT    /sat/section?domain=ADV                 (ACT the same under /act)
 */
export function sectionTestHref(
  exam: ExamId,
  section?: string | null,
  options: { level?: string | null } = {},
): string {
  const params = new URLSearchParams();
  let path: string;
  if (exam === 'KA') {
    path = '/practice/section';
    if (options.level) params.set('level', options.level);
    if (section) params.set('strand', section);
  } else if (exam === 'SAT' || exam === 'ACT') {
    path = exam === 'SAT' ? '/sat/section' : '/act/section';
    if (section) params.set('domain', section);
  } else {
    path = '/amc/section';
    params.set('contest', exam);
    if (section) params.set('area', section);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Where the full mock for this exam lives. */
export function mockHref(exam: ExamId): string {
  if (exam === 'KA') return '/practice/mock';
  if (exam === 'SAT') return '/sat/mock';
  if (exam === 'ACT') return '/act/mock';
  return `/amc/mock?contest=${exam}`;
}

/* -------------------------------------------------------------------------- */
/* Saving                                                                      */
/* -------------------------------------------------------------------------- */

/** One localStorage slot per route, so a SAT mock and an AMC section test never collide. */
export const EXAM_STORAGE_PREFIX = 'ka-exam:';

const EXAM_IDS: readonly string[] = ['KA', 'AMC8', 'AMC10', 'AMC12', 'SAT', 'ACT'];

/** Validates a saved run. Anything that does not look like one is treated as no run. */
export function parseExamState(raw: string | null): ExamState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ExamState> | null;
    if (!value || typeof value !== 'object') return null;
    if (value.v !== EXAM_STATE_VERSION) return null;
    if (value.kind !== 'mock' && value.kind !== 'section') return null;
    if (typeof value.exam !== 'string' || !EXAM_IDS.includes(value.exam)) return null;
    if (!Array.isArray(value.problemIds) || value.problemIds.length === 0) return null;
    if (!value.problemIds.every((id) => typeof id === 'string')) return null;
    if (!Array.isArray(value.modules) || value.modules.length === 0) return null;
    if (typeof value.answers !== 'object' || value.answers === null) return null;
    if (typeof value.startedAt !== 'string' || Number.isNaN(Date.parse(value.startedAt))) {
      return null;
    }
    if (
      typeof value.moduleStartedAt !== 'string' ||
      Number.isNaN(Date.parse(value.moduleStartedAt))
    ) {
      return null;
    }
    const total = value.modules.reduce(
      (sum, mod) => sum + (typeof mod?.count === 'number' ? mod.count : NaN),
      0,
    );
    if (total !== value.problemIds.length) return null;
    if (!value.problemIds.every((id) => value.answers?.[id] !== undefined)) return null;
    return value as ExamState;
  } catch {
    return null;
  }
}
