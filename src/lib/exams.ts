import type { Band } from './schemas';
import type { SessionExam } from './local-progress';
import { EXAM_SPECS, mockHref, type ExamSpec } from './exam-engine';

/**
 * The exam catalog (docs/08 items 1 and 2): one entry per exam the site prepares for, live or
 * coming soon. Exam pages, the home grade map, catalog cards, chips and chart legends all read
 * from here, so adding an exam is one entry below plus its tagged questions.
 *
 * Dependency-free at runtime so client components can import it: the only runtime import is
 * exam-engine.ts, which itself imports types only. Zod (schemas.ts) is never pulled in; the
 * Kangaroo levels are written out and a unit test checks them against BANDS and mock.ts.
 *
 * Formats for AMC 8/10/12, SAT and ACT are read from EXAM_SPECS (the engine that runs their
 * mocks), so the catalog and the timed paper can never disagree. Kangaroo's format is per
 * level; the coming-soon exams have no engine yet, so theirs are written here.
 *
 * Nothing here reproduces an official problem. Tips are our own advice about each format.
 */

export const LIVE_EXAM_IDS = ['ka', 'amc8', 'amc10', 'amc12', 'sat', 'act'] as const;
export const SOON_EXAM_IDS = ['aime', 'mathcounts', 'psat'] as const;
export const EXAM_IDS = [...LIVE_EXAM_IDS, ...SOON_EXAM_IDS] as const;

export type LiveExamId = (typeof LIVE_EXAM_IDS)[number];
export type SoonExamId = (typeof SOON_EXAM_IDS)[number];
export type CatalogExamId = LiveExamId | SoonExamId;
export type ExamStatus = 'live' | 'soon';

/** The token in tokens.css that colours an exam (soon exams share the neutral). */
export type ExamColorToken =
  | '--exam-ka'
  | '--exam-amc8'
  | '--exam-amc10'
  | '--exam-amc12'
  | '--exam-sat'
  | '--exam-act'
  | '--exam-soon';

/**
 * Tailwind utilities for the exam colour, written out in full so Tailwind's scanner sees
 * them. `fill` is a solid chip or bar with --on-exam text; `text` and `border` are the colour
 * as a label or an edge on a surface. All pairs are AA-tested in tokens.test.ts.
 */
export interface ExamColorClasses {
  fill: string;
  text: string;
  border: string;
  bg: string;
}

/** One timed part of a sitting: an SAT module, a MATHCOUNTS round. */
export interface ExamPart {
  label: string;
  questions: number;
  minutes: number;
}

export interface ExamFormat {
  /** Timed parts in order. A single-part exam has one. */
  parts: readonly ExamPart[];
  /** Totals across the parts. */
  questions: number;
  minutes: number;
  /** Multiple choice, or a typed answer (an integer on the AIME, a written answer on MATHCOUNTS). */
  answer: 'choice' | 'typed';
  /** Choices per question; null for typed answers. */
  choices: 4 | 5 | null;
  calculator: 'allowed' | 'not allowed' | 'some parts';
  /** "25 questions, 40 minutes, 5 choices". */
  summary: string;
}

export interface ExamScoring {
  /** One sentence, e.g. "6 points per correct answer, 1.5 per blank, 0 per wrong answer." */
  summary: string;
  /** Does a wrong answer cost more than a blank? */
  penalty: boolean;
  /** The best raw score on a full paper, in the exam's own points. */
  maxRaw: number;
  /** A reported scale, when the exam converts raw scores (SAT 200-800). */
  scale: { min: number; max: number; label: string } | null;
}

export interface ExamRoutes {
  /** The exam page (docs/08 item 3). Every exam has one, soon exams included. */
  page: string;
  /** Where practice starts. Null for a soon exam. */
  practice: string | null;
  /** The full timed mock. */
  mock: string | null;
  /** The question bank, filtered to this exam where the bank supports it. */
  bank: string | null;
  /** Learning material: the Skill Atlas, the AMC formula sheets, the area home. */
  learn: string | null;
}

/** A Kangaroo level: its own grades, paper length and filtered bank. */
export interface ExamTrack {
  id: Band;
  label: string;
  grades: { min: number; max: number };
  format: ExamFormat;
  scoring: ExamScoring;
  bank: string;
}

export interface Exam {
  id: CatalogExamId;
  /** "Math Kangaroo", "AMC 10", "SAT Math". */
  name: string;
  /** For chips and chart legends: "Kangaroo", "AMC 10", "SAT". */
  shortName: string;
  status: ExamStatus;
  /** One sentence for cards. */
  blurb: string;
  /** Who may sit it, in the organiser's terms, where that differs from the grade range. */
  eligibility: string;
  /** Grades the exam is usually taken in, inclusive, for the grade map (1-12). */
  grades: { min: number; max: number };
  color: ExamColorToken;
  classes: ExamColorClasses;
  /** The id this exam's sessions and engine spec use (progress file, EXAM_SPECS); null if none. */
  sessionExam: SessionExam | null;
  /** For Kangaroo, the upper levels' format; each track carries its own. */
  format: ExamFormat;
  scoring: ExamScoring;
  /** 3-5 original test-day tips. */
  tips: readonly string[];
  /**
   * Display names for topic (section) ids where this exam's name differs from the bank's
   * taxonomy name. Read through topicName(); ids not listed keep the taxonomy name.
   */
  topicNames: Readonly<Record<string, string>>;
  /** The closest exam: for a soon exam, the live one to practise meanwhile. */
  related: CatalogExamId | null;
  routes: ExamRoutes;
  /** Kangaroo levels; empty for every other exam. */
  tracks: readonly ExamTrack[];
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                             */
/* -------------------------------------------------------------------------- */

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function minutesText(minutes: number): string {
  if (minutes % 60 === 0 && minutes >= 60) return plural(minutes / 60, 'hour');
  return plural(minutes, 'minute');
}

function format(
  parts: readonly ExamPart[],
  answer: ExamFormat['answer'],
  choices: ExamFormat['choices'],
  calculator: ExamFormat['calculator'],
): ExamFormat {
  const questions = parts.reduce((sum, part) => sum + part.questions, 0);
  const minutes = parts.reduce((sum, part) => sum + part.minutes, 0);
  const tail = choices === null ? 'typed answers' : `${choices} choices`;
  return {
    parts,
    questions,
    minutes,
    answer,
    choices,
    calculator,
    summary: `${plural(questions, 'question')}, ${minutesText(minutes)}, ${tail}`,
  };
}

/** A live exam's format, from the engine spec that runs its mock. */
function specFormat(spec: ExamSpec, calculator: ExamFormat['calculator']): ExamFormat {
  const parts = (spec.mock ?? []).map((mod) => ({
    label: mod.label,
    questions: mod.count,
    minutes: mod.minutes,
  }));
  return format(parts, 'choice', spec.choiceCount, calculator);
}

function classes(token: ExamColorToken): ExamColorClasses {
  // Literal strings per token: Tailwind only generates classes it can read in the source.
  switch (token) {
    case '--exam-ka':
      return {
        fill: 'bg-exam-ka text-on-exam',
        text: 'text-exam-ka',
        border: 'border-exam-ka',
        bg: 'bg-exam-ka',
      };
    case '--exam-amc8':
      return {
        fill: 'bg-exam-amc8 text-on-exam',
        text: 'text-exam-amc8',
        border: 'border-exam-amc8',
        bg: 'bg-exam-amc8',
      };
    case '--exam-amc10':
      return {
        fill: 'bg-exam-amc10 text-on-exam',
        text: 'text-exam-amc10',
        border: 'border-exam-amc10',
        bg: 'bg-exam-amc10',
      };
    case '--exam-amc12':
      return {
        fill: 'bg-exam-amc12 text-on-exam',
        text: 'text-exam-amc12',
        border: 'border-exam-amc12',
        bg: 'bg-exam-amc12',
      };
    case '--exam-sat':
      return {
        fill: 'bg-exam-sat text-on-exam',
        text: 'text-exam-sat',
        border: 'border-exam-sat',
        bg: 'bg-exam-sat',
      };
    case '--exam-act':
      return {
        fill: 'bg-exam-act text-on-exam',
        text: 'text-exam-act',
        border: 'border-exam-act',
        bg: 'bg-exam-act',
      };
    case '--exam-soon':
      return {
        fill: 'bg-exam-soon text-on-exam',
        text: 'text-exam-soon',
        border: 'border-exam-soon',
        bg: 'bg-exam-soon',
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Math Kangaroo levels                                                        */
/* -------------------------------------------------------------------------- */

/** Mirrors BANDS in schemas.ts (checked by a unit test, so the two cannot drift). */
const KA_LEVELS: readonly Band[] = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'];

/** 75 minutes at every level; mirrors MOCK_MINUTES in mock.ts. */
const KA_MINUTES = 75;

/** 24 questions (8 per point tier) for levels 1-2 and 3-4, 30 (10 per tier) above. */
function kaQuestions(band: Band): number {
  return band === '1-2' || band === '3-4' ? 24 : 30;
}

function kaScoring(questions: number): ExamScoring {
  const perTier = questions / 3;
  return {
    summary:
      `Three blocks of ${perTier} questions worth 3, 4 and 5 points; ` +
      'a wrong answer or a blank scores 0.',
    penalty: false,
    maxRaw: perTier * (3 + 4 + 5),
    scale: null,
  };
}

const KA_TRACKS: readonly ExamTrack[] = KA_LEVELS.map((band) => {
  const [min = 1, max = 12] = band.split('-').map(Number);
  const questions = kaQuestions(band);
  return {
    id: band,
    label: `Level ${band}`,
    grades: { min, max },
    format: format(
      [{ label: `Level ${band}`, questions, minutes: KA_MINUTES }],
      'choice',
      5,
      'not allowed',
    ),
    scoring: kaScoring(questions),
    bank: `/problems?level=${band}`,
  };
});

/* -------------------------------------------------------------------------- */
/* The catalog                                                                 */
/* -------------------------------------------------------------------------- */

const AMC_10_12_SCORING: ExamScoring = {
  summary: '6 points per correct answer, 1.5 per question left blank, 0 per wrong answer.',
  penalty: true,
  maxRaw: 150,
  scale: null,
};

const AMC_GUESS_TIP =
  'A blank is worth 1.5 points and a random guess only 1.2 on average, so leave a question ' +
  'blank unless you can rule out choices. Rule out two and a guess is worth 2.';

export const EXAMS: readonly Exam[] = [
  {
    id: 'ka',
    name: 'Math Kangaroo',
    shortName: 'Kangaroo',
    status: 'live',
    blurb: 'Puzzle-style problems for grades 1-12, practised by skill across six levels.',
    eligibility: 'Grades 1-12, in six two-grade levels.',
    grades: { min: 1, max: 12 },
    color: '--exam-ka',
    classes: classes('--exam-ka'),
    sessionExam: 'KA',
    format: KA_TRACKS[KA_TRACKS.length - 1]?.format ?? format([], 'choice', 5, 'not allowed'),
    scoring: KA_TRACKS[KA_TRACKS.length - 1]?.scoring ?? kaScoring(30),
    tips: [
      'A wrong answer costs nothing more than a blank, so put an answer on every question.',
      'Points rise in three blocks of 3, 4 and 5. Secure the 3-point block before sinking ' +
        'time into a 5-pointer.',
      'Many questions are puzzles rather than sums: draw the picture, try a small case or ' +
        'test the answer choices.',
      'With 75 minutes you have about three minutes a question. If one has taken twice that, ' +
        'mark it and come back.',
      'Read the last line twice. Words like "cannot", "at least" and "exactly" decide the answer.',
    ],
    topicNames: {},
    related: 'amc8',
    routes: {
      page: '/exams/ka',
      practice: '/',
      mock: mockHref('KA'),
      bank: '/problems',
      learn: '/atlas',
    },
    tracks: KA_TRACKS,
  },
  {
    id: 'amc8',
    name: 'AMC 8',
    shortName: 'AMC 8',
    status: 'live',
    blurb: 'The MAA middle-school contest: 25 multiple-choice questions in 40 minutes.',
    eligibility: 'Grade 8 and below.',
    grades: { min: 5, max: 8 },
    color: '--exam-amc8',
    classes: classes('--exam-amc8'),
    sessionExam: 'AMC8',
    format: specFormat(EXAM_SPECS.AMC8, 'not allowed'),
    scoring: {
      summary: '1 point per correct answer; a wrong answer or a blank scores 0.',
      penalty: false,
      maxRaw: 25,
      scale: null,
    },
    tips: [
      'There is no penalty for a wrong answer, so answer all 25 questions, guessing on any ' +
        'you cannot finish.',
      '40 minutes for 25 questions is under two minutes each. The early questions should ' +
        'take well under a minute.',
      'No calculator is allowed. Practise clean arithmetic with fractions, percents and ' +
        'quick estimates.',
      'The later questions often give way to a picture or a short list of cases faster ' +
        'than to a long calculation.',
    ],
    topicNames: { ALG: 'Arithmetic and algebra' },
    related: 'amc10',
    routes: {
      page: '/exams/amc8',
      practice: '/amc',
      mock: mockHref('AMC8'),
      bank: '/amc/problems?level=AMC8',
      learn: '/amc/formulas',
    },
    tracks: [],
  },
  {
    id: 'amc10',
    name: 'AMC 10',
    shortName: 'AMC 10',
    status: 'live',
    blurb: 'The MAA contest for grade 10 and below: 25 questions, 75 minutes, a path to the AIME.',
    eligibility: 'Grade 10 and below, and under 17.5 years old on the day of the contest.',
    grades: { min: 8, max: 10 },
    color: '--exam-amc10',
    classes: classes('--exam-amc10'),
    sessionExam: 'AMC10',
    format: specFormat(EXAM_SPECS.AMC10, 'not allowed'),
    scoring: AMC_10_12_SCORING,
    tips: [
      AMC_GUESS_TIP,
      '75 minutes for 25 questions is three minutes each. Move quickly through the first ten ' +
        'to bank time for the last ten.',
      'No calculator is allowed, and answers are built to come out cleanly: a messy number ' +
        'is a sign to recheck.',
      'Look at the answer choices before you start. Their form (a radical, a fraction, a ' +
        'range) often hints at the method.',
      'A high score can earn an invitation to the AIME.',
    ],
    topicNames: {},
    related: 'amc12',
    routes: {
      page: '/exams/amc10',
      practice: '/amc',
      mock: mockHref('AMC10'),
      bank: '/amc/problems?level=AMC10',
      learn: '/amc/formulas',
    },
    tracks: [],
  },
  {
    id: 'amc12',
    name: 'AMC 12',
    shortName: 'AMC 12',
    status: 'live',
    blurb: 'The MAA contest for grade 12 and below, adding precalculus topics to the AMC 10.',
    eligibility: 'Grade 12 and below, and under 19.5 years old on the day of the contest.',
    grades: { min: 10, max: 12 },
    color: '--exam-amc12',
    classes: classes('--exam-amc12'),
    sessionExam: 'AMC12',
    format: specFormat(EXAM_SPECS.AMC12, 'not allowed'),
    scoring: AMC_10_12_SCORING,
    tips: [
      AMC_GUESS_TIP,
      'The topics reach past the AMC 10: trigonometry, logarithms, complex numbers and ' +
        'sequences all appear.',
      'The first half overlaps heavily with the AMC 10, so speed there buys time for the ' +
        'hardest questions.',
      'No calculator is allowed. Keep exact forms like square roots and pi until the last step.',
      'A high score can earn an invitation to the AIME.',
    ],
    topicNames: {},
    related: 'aime',
    routes: {
      page: '/exams/amc12',
      practice: '/amc',
      mock: mockHref('AMC12'),
      bank: '/amc/problems?level=AMC12',
      learn: '/amc/formulas',
    },
    tracks: [],
  },
  {
    id: 'sat',
    name: 'SAT Math',
    shortName: 'SAT',
    status: 'live',
    blurb: 'The math section of the digital SAT: two 35-minute modules of 22 questions.',
    eligibility: 'Open to any student; usually taken in grades 11 and 12.',
    grades: { min: 10, max: 12 },
    color: '--exam-sat',
    classes: classes('--exam-sat'),
    sessionExam: 'SAT',
    format: specFormat(EXAM_SPECS.SAT, 'allowed'),
    scoring: {
      summary:
        'Correct answers are converted to a section score from 200 to 800; a wrong answer ' +
        'scores the same as a blank.',
      penalty: false,
      maxRaw: 44,
      scale: { min: 200, max: 800, label: 'Section score' },
    },
    tips: [
      'There is no penalty for a wrong answer, so answer every question before time runs out.',
      'A calculator is allowed for the whole section, and the testing app has a graphing ' +
        'calculator built in. Graphing a system can beat solving it by hand.',
      'Each module gives you 35 minutes for 22 questions, about a minute and a half each.',
      'The real test is adaptive: how you do in module 1 sets the difficulty of module 2. ' +
        'Our mocks are not adaptive, and every question here is multiple choice.',
      'A reference sheet of area and volume formulas is provided. Know what is on it so you ' +
        'can spend your memory elsewhere.',
    ],
    topicNames: { PSD: 'Problem solving and data', GEO: 'Geometry and trigonometry' },
    related: 'act',
    routes: {
      page: '/exams/sat',
      practice: '/sat',
      mock: mockHref('SAT'),
      bank: '/sat/problems',
      learn: '/sat',
    },
    tracks: [],
  },
  {
    id: 'act',
    name: 'ACT Math',
    shortName: 'ACT',
    status: 'live',
    blurb: 'The math test of the ACT: 45 four-choice questions in 50 minutes.',
    eligibility: 'Open to any student; usually taken in grades 11 and 12.',
    grades: { min: 11, max: 12 },
    color: '--exam-act',
    classes: classes('--exam-act'),
    sessionExam: 'ACT',
    format: specFormat(EXAM_SPECS.ACT, 'allowed'),
    scoring: {
      summary:
        'Correct answers are converted to a score from 1 to 36; a wrong answer scores the ' +
        'same as a blank.',
      penalty: false,
      maxRaw: 45,
      scale: { min: 1, max: 36, label: 'Math score' },
    },
    tips: [
      'There is no penalty for a wrong answer, so fill in every question.',
      '50 minutes for 45 questions is just over a minute each. Mark a slow one and move on.',
      'A calculator is allowed on the whole math test, but some models are banned. Check the ' +
        'ACT calculator policy before test day.',
      'No formula sheet is given, so know area, volume, slope and basic trigonometry by heart.',
    ],
    topicNames: { NQ: 'Number and quantity', STAT: 'Statistics and probability' },
    related: 'sat',
    routes: {
      page: '/exams/act',
      practice: '/act',
      mock: mockHref('ACT'),
      bank: '/act/problems',
      learn: '/act',
    },
    tracks: [],
  },
  {
    id: 'aime',
    name: 'AIME',
    shortName: 'AIME',
    status: 'soon',
    blurb: 'The invitational exam after the AMC 10 and 12: 15 problems, 3 hours, integer answers.',
    eligibility: 'By invitation, from a high AMC 10 or AMC 12 score.',
    grades: { min: 9, max: 12 },
    color: '--exam-soon',
    classes: classes('--exam-soon'),
    sessionExam: null,
    format: format([{ label: 'AIME', questions: 15, minutes: 180 }], 'typed', null, 'not allowed'),
    scoring: {
      summary: '1 point per correct answer. Every answer is an integer from 0 to 999.',
      penalty: false,
      maxRaw: 15,
      scale: null,
    },
    tips: [
      'Every answer is an integer from 0 to 999, so there are no choices to test. Check by ' +
        'substituting your answer back.',
      'Three hours for 15 problems is 12 minutes each, but most scores are built on solving ' +
        'the first several carefully.',
      'There is no penalty for a wrong answer, so write an answer for every problem.',
      'No calculator is allowed. AMC 12 practice is the best preparation while this is coming.',
    ],
    topicNames: {},
    related: 'amc12',
    routes: { page: '/exams/aime', practice: null, mock: null, bank: null, learn: null },
    tracks: [],
  },
  {
    id: 'mathcounts',
    name: 'MATHCOUNTS',
    shortName: 'MATHCOUNTS',
    status: 'soon',
    blurb:
      'The middle-school competition: a 30-problem Sprint round and an 8-problem Target round.',
    eligibility: 'Grades 6-8.',
    grades: { min: 6, max: 8 },
    color: '--exam-soon',
    classes: classes('--exam-soon'),
    sessionExam: null,
    format: format(
      [
        { label: 'Sprint', questions: 30, minutes: 40 },
        { label: 'Target', questions: 8, minutes: 24 },
      ],
      'typed',
      null,
      'some parts',
    ),
    scoring: {
      summary: 'Sprint problems score 1 point each and Target problems 2, for 46 in all.',
      penalty: false,
      maxRaw: 46,
      scale: null,
    },
    tips: [
      'Sprint is 30 problems in 40 minutes with no calculator, so quick mental arithmetic pays.',
      'Target is 8 problems handed out in pairs, 6 minutes a pair, with a calculator: set up ' +
        'carefully and check.',
      'A wrong answer costs nothing more than a blank, so answer everything.',
      'Answers are written in, not chosen. Give them in the form the problem asks for.',
      'AMC 8 practice builds the same skills while this is coming.',
    ],
    topicNames: {},
    related: 'amc8',
    routes: { page: '/exams/mathcounts', practice: null, mock: null, bank: null, learn: null },
    tracks: [],
  },
  {
    id: 'psat',
    name: 'PSAT Math',
    shortName: 'PSAT',
    status: 'soon',
    blurb: 'The math section of the digital PSAT: 44 questions in 70 minutes, scored 160-760.',
    eligibility: 'Usually taken in grades 10 and 11.',
    grades: { min: 10, max: 11 },
    color: '--exam-soon',
    classes: classes('--exam-soon'),
    sessionExam: null,
    format: format(
      [
        { label: 'Module 1', questions: 22, minutes: 35 },
        { label: 'Module 2', questions: 22, minutes: 35 },
      ],
      'choice',
      4,
      'allowed',
    ),
    scoring: {
      summary:
        'Correct answers are converted to a section score from 160 to 760; a wrong answer ' +
        'scores the same as a blank.',
      penalty: false,
      maxRaw: 44,
      scale: { min: 160, max: 760, label: 'Section score' },
    },
    tips: [
      'The math section has the same shape as the SAT: two modules of 22 questions, 35 ' +
        'minutes each.',
      'A calculator is allowed throughout, with a graphing calculator built into the app.',
      'There is no penalty for a wrong answer, so answer every question.',
      'The PSAT/NMSQT taken in grade 11 is used to qualify for National Merit recognition.',
      'SAT practice covers the same content while this is coming.',
    ],
    topicNames: {},
    related: 'sat',
    routes: { page: '/exams/psat', practice: null, mock: null, bank: null, learn: null },
    tracks: [],
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const BY_ID = new Map<string, Exam>(EXAMS.map((exam) => [exam.id, exam]));

export function isCatalogExamId(id: string): id is CatalogExamId {
  return BY_ID.has(id);
}

/** The exam with this id, or undefined for an unknown id (e.g. a bad route param). */
export function examById(id: string): Exam | undefined {
  return BY_ID.get(id);
}

/** Live exams, in catalog order. */
export function liveExams(): readonly Exam[] {
  return EXAMS.filter((exam) => exam.status === 'live');
}

/** Coming-soon exams, in catalog order. */
export function soonExams(): readonly Exam[] {
  return EXAMS.filter((exam) => exam.status === 'soon');
}

/**
 * Exams usually taken in this grade (1-12), live first, in catalog order. An out-of-range or
 * non-integer grade matches nothing.
 */
export function examsForGrade(grade: number, options: { live?: boolean } = {}): readonly Exam[] {
  if (!Number.isInteger(grade)) return [];
  const matching = EXAMS.filter(
    (exam) =>
      grade >= exam.grades.min &&
      grade <= exam.grades.max &&
      (options.live !== true || exam.status === 'live'),
  );
  return [...matching].sort((a, b) => (a.status === b.status ? 0 : a.status === 'live' ? -1 : 1));
}

/** The catalog entry for a session id in the progress file ('AMC10' -> the AMC 10). */
export function examForSession(session: SessionExam): Exam | undefined {
  return EXAMS.find((exam) => exam.sessionExam === session);
}

/** The Kangaroo level for a grade (1-12), e.g. 7 -> '7-8'. */
export function kaTrackForGrade(grade: number): ExamTrack | undefined {
  return examById('ka')?.tracks.find((t) => grade >= t.grades.min && grade <= t.grades.max);
}

/** A topic's display name on this exam: the exam's override, else the taxonomy name given. */
export function topicName(exam: Exam, topicId: string, taxonomyName: string): string {
  return exam.topicNames[topicId] ?? taxonomyName;
}

/** `var(--exam-amc10)`, for inline SVG strokes and fills in charts. */
export function examColorVar(exam: Exam): string {
  return `var(${exam.color})`;
}
