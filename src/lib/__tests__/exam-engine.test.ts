import { describe, expect, it } from 'vitest';
import {
  chooseAnswer,
  clearAnswer,
  countBlanks,
  countFlagged,
  estimateScale,
  EXAM_SPECS,
  finishExam,
  formatClock,
  goToQuestion,
  mockHref,
  mockMinutes,
  mockQuestionCount,
  NUDGE_AT_MS,
  nudgeCopy,
  parseExamState,
  questionScore,
  remainingMs,
  scoreExam,
  sectionTestHref,
  sectionTestMinutes,
  shouldNudge,
  startExam,
  submitModule,
  syncClock,
  toggleFlag,
  toSessionRecord,
  type ExamItemFacts,
  type ExamState,
} from '../exam-engine';
import { cleanSession } from '../local-progress';

const T0 = new Date('2026-11-18T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;

function ids(n: number, prefix = 'AM-'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(4, '0')}`);
}

function amc10(): ExamState {
  return startExam({
    kind: 'mock',
    exam: 'AMC10',
    title: 'AMC 10 mock',
    seed: 1,
    problemIds: ids(25),
    modules: EXAM_SPECS.AMC10.mock ?? [],
    labels: { ALG: 'Algebra', GEO: 'Geometry' },
    now: T0,
  });
}

function sat(): ExamState {
  return startExam({
    kind: 'mock',
    exam: 'SAT',
    title: 'SAT Math mock',
    seed: 1,
    problemIds: ids(44, 'SA-'),
    modules: EXAM_SPECS.SAT.mock ?? [],
    now: T0,
  });
}

/** Every question's answer is A; sections alternate ALG / GEO. */
function facts(state: ExamState, points = 3): Map<string, ExamItemFacts> {
  return new Map(
    state.problemIds.map((id, index) => [
      id,
      {
        id,
        correctKey: 'A',
        points,
        section: index % 2 === 0 ? 'ALG' : 'GEO',
        group: index % 2 === 0 ? 'ALG-01' : 'GEO-02',
        groupName: index % 2 === 0 ? 'Linear' : 'Triangles',
      },
    ]),
  );
}

function answer(state: ExamState, index: number, key: 'A' | 'B' | 'C' | 'D' | 'E'): ExamState {
  return chooseAnswer(goToQuestion(state, index, T0), key);
}

describe('exam specs', () => {
  it('match the real formats in docs/07', () => {
    expect([mockQuestionCount(EXAM_SPECS.AMC8), mockMinutes(EXAM_SPECS.AMC8)]).toEqual([25, 40]);
    expect([mockQuestionCount(EXAM_SPECS.AMC10), mockMinutes(EXAM_SPECS.AMC10)]).toEqual([25, 75]);
    expect([mockQuestionCount(EXAM_SPECS.AMC12), mockMinutes(EXAM_SPECS.AMC12)]).toEqual([25, 75]);
    expect([mockQuestionCount(EXAM_SPECS.SAT), mockMinutes(EXAM_SPECS.SAT)]).toEqual([44, 70]);
    expect(EXAM_SPECS.SAT.mock?.map((m) => m.count)).toEqual([22, 22]);
    expect([mockQuestionCount(EXAM_SPECS.ACT), mockMinutes(EXAM_SPECS.ACT)]).toEqual([45, 50]);
    expect(EXAM_SPECS.KA.mock).toBeNull();
  });

  it('score AMC 10/12 6 / 1.5 / 0, AMC 8 1 / 0, SAT and ACT 1 per correct', () => {
    expect(
      ['correct', 'blank', 'wrong'].map((o) =>
        questionScore(EXAM_SPECS.AMC10.scoring, o as never, 3),
      ),
    ).toEqual([6, 1.5, 0]);
    expect(
      ['correct', 'blank', 'wrong'].map((o) =>
        questionScore(EXAM_SPECS.AMC12.scoring, o as never, 3),
      ),
    ).toEqual([6, 1.5, 0]);
    expect(
      ['correct', 'blank', 'wrong'].map((o) =>
        questionScore(EXAM_SPECS.AMC8.scoring, o as never, 3),
      ),
    ).toEqual([1, 0, 0]);
    expect(
      ['correct', 'blank', 'wrong'].map((o) =>
        questionScore(EXAM_SPECS.SAT.scoring, o as never, 5),
      ),
    ).toEqual([1, 0, 0]);
    expect(
      ['correct', 'blank', 'wrong'].map((o) =>
        questionScore(EXAM_SPECS.ACT.scoring, o as never, 5),
      ),
    ).toEqual([1, 0, 0]);
    expect(
      ['correct', 'blank', 'wrong'].map((o) => questionScore(EXAM_SPECS.KA.scoring, o as never, 5)),
    ).toEqual([5, 0, 0]);
  });
});

describe('starting', () => {
  it('lays the modules out over the paper', () => {
    const state = sat();
    expect(state.modules.map((m) => [m.start, m.count, m.durationMs])).toEqual([
      [0, 22, 35 * MIN],
      [22, 22, 35 * MIN],
    ]);
    expect(Object.keys(state.answers)).toHaveLength(44);
    expect(countBlanks(state)).toBe(44);
  });

  it('refuses modules that do not add up to the paper', () => {
    expect(() =>
      startExam({
        kind: 'mock',
        exam: 'AMC10',
        title: 'x',
        seed: 1,
        problemIds: ids(24),
        modules: EXAM_SPECS.AMC10.mock ?? [],
        now: T0,
      }),
    ).toThrow(RangeError);
  });
});

describe('the clock', () => {
  it('is computed from the wall clock, so a refresh keeps the time', () => {
    const state = amc10();
    expect(remainingMs(state, at(40 * MIN))).toBe(35 * MIN);
    // Round-tripped through storage, exactly as a refresh would.
    const restored = parseExamState(JSON.stringify(state));
    expect(restored && remainingMs(restored, at(40 * MIN))).toBe(35 * MIN);
  });

  it('submits a single-module paper when time runs out, at the moment it ran out', () => {
    const state = syncClock(amc10(), at(80 * MIN));
    expect(state.finishedAt).toBe(at(75 * MIN).toISOString());
  });

  it('leaves the state alone while time remains', () => {
    const state = amc10();
    expect(syncClock(state, at(10 * MIN))).toBe(state);
  });

  it('closes an SAT module when its time runs out and starts the next from that moment', () => {
    const state = syncClock(sat(), at(40 * MIN));
    expect(state.finishedAt).toBeNull();
    expect(state.moduleIndex).toBe(1);
    expect(state.current).toBe(22);
    expect(state.moduleStartedAt).toBe(at(35 * MIN).toISOString());
    expect(remainingMs(state, at(40 * MIN))).toBe(30 * MIN);
  });

  it('runs through both SAT modules after a long absence', () => {
    const state = syncClock(sat(), at(200 * MIN));
    expect(state.finishedAt).toBe(at(70 * MIN).toISOString());
  });

  it('formats the clock', () => {
    expect(formatClock(75 * MIN)).toBe('75:00');
    expect(formatClock(65_400)).toBe('1:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('moving, answering, flagging', () => {
  it('keeps navigation inside the current module', () => {
    let state = sat();
    state = goToQuestion(state, 30, at(MIN));
    expect(state.current).toBe(21);
    state = submitModule(state, at(2 * MIN));
    expect(state.moduleIndex).toBe(1);
    state = goToQuestion(state, 3, at(3 * MIN));
    expect(state.current).toBe(22);
  });

  it('banks the time spent on the question being left', () => {
    let state = amc10();
    state = goToQuestion(state, 1, at(90_000));
    expect(state.answers['AM-0001']?.msSpent).toBe(90_000);
  });

  it('answers, changes, clears and flags the question on screen', () => {
    let state = amc10();
    state = chooseAnswer(state, 'B');
    state = chooseAnswer(state, 'C');
    expect(state.answers['AM-0001']?.chosenKey).toBe('C');
    state = clearAnswer(state);
    expect(state.answers['AM-0001']?.chosenKey).toBeNull();
    state = toggleFlag(state);
    expect(countFlagged(state)).toBe(1);
    state = toggleFlag(state);
    expect(countFlagged(state)).toBe(0);
  });

  it('ignores every change once finished', () => {
    const done = finishExam(amc10(), at(MIN));
    expect(chooseAnswer(done, 'A')).toBe(done);
    expect(goToQuestion(done, 4, at(2 * MIN))).toBe(done);
    expect(submitModule(done, at(2 * MIN))).toBe(done);
  });
});

describe('the blank nudge', () => {
  it('appears in the last five minutes of a module with a blank in it', () => {
    const state = amc10();
    expect(shouldNudge(state, at(75 * MIN - NUDGE_AT_MS - 1000))).toBe(false);
    expect(shouldNudge(state, at(75 * MIN - NUDGE_AT_MS + 1000))).toBe(true);
  });

  it('only counts blanks in the current module', () => {
    let state = sat();
    for (let index = 0; index < 22; index += 1) state = answer(state, index, 'A');
    expect(shouldNudge(state, at(32 * MIN))).toBe(false);
  });

  it('says guess freely on a no-penalty paper, and guess with care on AMC 10/12', () => {
    expect(nudgeCopy(EXAM_SPECS.SAT, 3).body).toMatch(/A wrong answer costs nothing/);
    expect(nudgeCopy(EXAM_SPECS.AMC8, 1).title).toMatch(/1 question is blank/);
    const amc = nudgeCopy(EXAM_SPECS.AMC10, 2).body;
    expect(amc).toMatch(/blank scores 1.5/);
    expect(amc).toMatch(/1.2 on average/);
    expect(amc).toMatch(/rule out at least two/);
  });
});

describe('scoring', () => {
  it('scores AMC 10: 6 per right, 1.5 per blank, 0 per wrong, out of 150', () => {
    let state = amc10();
    state = answer(state, 0, 'A');
    state = answer(state, 1, 'A');
    state = answer(state, 2, 'B');
    state = finishExam(state, at(30 * MIN));
    const report = scoreExam(state, EXAM_SPECS.AMC10, facts(state));
    expect(report.max).toBe(150);
    expect([report.correct, report.wrong, report.blank]).toEqual([2, 1, 22]);
    expect(report.score).toBe(2 * 6 + 22 * 1.5);
    expect(report.scale).toBeNull();
  });

  it('scores Kangaroo by each question’s points', () => {
    let state = startExam({
      kind: 'section',
      exam: 'KA',
      section: 'GEO',
      title: 'Section',
      seed: 1,
      problemIds: ids(5, 'KA-'),
      modules: [{ label: 'Section', count: 5, minutes: 6 }],
      now: T0,
    });
    state = answer(state, 0, 'A');
    state = finishExam(state, at(MIN));
    const report = scoreExam(state, EXAM_SPECS.KA, facts(state, 4));
    expect([report.score, report.max]).toEqual([4, 20]);
    // A section test ranks skills, not sections.
    expect(report.focusLevel).toBe('group');
    expect(report.focus.map((f) => f.id)).toEqual(['GEO-02', 'ALG-01']);
  });

  it('breaks accuracy down by section and names the weakest first', () => {
    let state = amc10();
    // Right on every ALG question (even index), wrong on every GEO one.
    for (let index = 0; index < 25; index += 1) state = answer(state, index, index % 2 ? 'B' : 'A');
    state = finishExam(state, at(MIN));
    const report = scoreExam(state, EXAM_SPECS.AMC10, facts(state));
    expect(report.sections).toEqual([
      { id: 'ALG', name: 'Algebra', asked: 13, correct: 13, blank: 0 },
      { id: 'GEO', name: 'Geometry', asked: 12, correct: 0, blank: 0 },
    ]);
    expect(report.focusLevel).toBe('section');
    expect(report.focus.map((f) => f.id)).toEqual(['GEO']);
  });

  it('gives a full SAT mock an approximate scale as a range', () => {
    let state = sat();
    for (let index = 0; index < 22; index += 1) state = answer(state, index, 'A');
    state = submitModule(state, at(MIN));
    state = finishExam(state, at(2 * MIN));
    const report = scoreExam(state, EXAM_SPECS.SAT, facts(state));
    expect([report.score, report.max]).toEqual([22, 44]);
    expect(report.scale).toEqual({ kind: 'sat', min: 200, max: 800, low: 470, high: 530 });
  });

  it('keeps estimates inside the real scales', () => {
    expect(estimateScale('sat', 44, 44)).toMatchObject({ low: 770, high: 800 });
    expect(estimateScale('sat', 0, 44)).toMatchObject({ low: 200, high: 230 });
    expect(estimateScale('act', 45, 45)).toMatchObject({ low: 35, high: 36 });
    expect(estimateScale('act', 0, 45)).toMatchObject({ low: 1, high: 2 });
  });

  it('turns a finished sitting into a session the progress file accepts', () => {
    let state = amc10();
    state = answer(state, 0, 'A');
    state = finishExam(state, at(20 * MIN));
    const report = scoreExam(state, EXAM_SPECS.AMC10, facts(state));
    const record = toSessionRecord(state, report);
    expect(record).toEqual({
      kind: 'mock',
      exam: 'AMC10',
      at: at(20 * MIN).toISOString(),
      score: 6 + 24 * 1.5,
      max: 150,
      correct: 1,
      total: 25,
      durationMs: 20 * MIN,
    });
    expect(cleanSession(record)).toEqual(record);
  });

  it('carries the section of a section test', () => {
    let state = startExam({
      kind: 'section',
      exam: 'SAT',
      section: 'ADV',
      title: 'x',
      seed: 1,
      problemIds: ids(5, 'SA-'),
      modules: [{ label: 'x', count: 5, minutes: 5 }],
      now: T0,
    });
    state = finishExam(state, at(MIN));
    const record = toSessionRecord(state, scoreExam(state, EXAM_SPECS.SAT, facts(state)));
    expect(record?.section).toBe('ADV');
  });
});

describe('section tests', () => {
  it('time the test as the sum of estimates rounded up to the minute', () => {
    expect(sectionTestMinutes([60, 60, 61])).toBe(4);
    expect(sectionTestMinutes([90, 90])).toBe(3);
    expect(sectionTestMinutes([])).toBe(1);
  });

  it('link to the right route with the section preselected', () => {
    expect(sectionTestHref('KA', 'GEO', { level: '3-4' })).toBe(
      '/practice/section?level=3-4&strand=GEO',
    );
    expect(sectionTestHref('AMC10', 'ALG')).toBe('/amc/section?contest=AMC10&area=ALG');
    expect(sectionTestHref('AMC8')).toBe('/amc/section?contest=AMC8');
    expect(sectionTestHref('SAT', 'ADV')).toBe('/sat/section?domain=ADV');
    expect(sectionTestHref('ACT')).toBe('/act/section');
    expect(mockHref('AMC12')).toBe('/amc/mock?contest=AMC12');
    expect(mockHref('KA')).toBe('/practice/mock');
  });
});

describe('saved state', () => {
  it('round-trips and rejects anything that is not a run', () => {
    const state = amc10();
    expect(parseExamState(JSON.stringify(state))).toEqual(state);
    expect(parseExamState(null)).toBeNull();
    expect(parseExamState('not json')).toBeNull();
    expect(parseExamState(JSON.stringify({ ...state, v: 99 }))).toBeNull();
    expect(parseExamState(JSON.stringify({ ...state, exam: 'GRE' }))).toBeNull();
    expect(parseExamState(JSON.stringify({ ...state, problemIds: ids(24) }))).toBeNull();
  });
});
