import { describe, it, expect } from 'vitest';
import type { AttemptRecord } from '../mastery';
import { EMPTY_PROGRESS, type ProgressFile, type SessionRecord } from '../local-progress';
import {
  activityLevel,
  answerInExam,
  answeredCounts,
  bankEvents,
  bankSessions,
  bankSummary,
  compareRecent,
  compareTests,
  dailyActivity,
  examAnswers,
  examFilterCounts,
  examSessions,
  focusTopic,
  parseExamFilter,
  practiceAnswers,
  progressSentence,
  scoreSeries,
  sessionReview,
  sessionReviewIds,
  timeStats,
  topicRows,
  topicTag,
  mondayOf,
  needsPractice,
  percentLabel,
  sectionStats,
  sectionTestHref,
  trendOf,
  weeklyStats,
  type BankSpec,
  type SectionStat,
  type WeekStat,
} from '../progress-analytics';
import { progressBanks } from '../progress-page-data';

const NOW = new Date(2026, 10, 18, 15); // Wednesday 18 Nov 2026, local time

function at(daysAgo: number, hour = 16): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function attempt(problemId: string, correct: boolean, when: string): AttemptRecord {
  return { problemId, correct, at: when, points: 3, hintsUsed: 0 };
}

const KA: BankSpec = {
  bank: 'KA',
  sections: [
    {
      id: 'NUM',
      name: 'Number',
      subs: [
        { id: 'NUM-01', name: 'Place value' },
        { id: 'NUM-02', name: 'Fractions' },
      ],
    },
    { id: 'GEO', name: 'Geometry', subs: [{ id: 'GEO-01', name: 'Angles' }] },
  ],
  groups: [
    { sub: null, meta: '3-4', ids: ['KA-0001', 'KA-0002'] },
    { sub: null, meta: '5-6', ids: ['KA-0003'] },
  ],
};

const AMC: BankSpec = {
  bank: 'AMC',
  sections: [
    { id: 'ALG', name: 'Algebra', subs: [{ id: 'ALG-01', name: 'Linear equations' }] },
    { id: 'GEO', name: 'Geometry', subs: [{ id: 'GEO-01', name: 'Triangles' }] },
  ],
  groups: [
    { sub: 'ALG-01', meta: 'BOTH', ids: ['AM-0001'] },
    { sub: 'GEO-01', meta: 'AMC8', ids: ['AM-1001'] },
  ],
};

const SAT: BankSpec = {
  bank: 'SAT',
  sections: [{ id: 'ALG', name: 'Algebra', subs: [{ id: 'ALG-01', name: 'Linear' }] }],
  groups: [{ sub: 'ALG-01', meta: null, ids: ['SA-0001'] }],
};

const ACT: BankSpec = {
  bank: 'ACT',
  sections: [{ id: 'ALG', name: 'Algebra', subs: [{ id: 'ALG-01', name: 'Linear' }] }],
  groups: [{ sub: 'ALG-01', meta: null, ids: ['AC-0001'] }],
};

function file(attempts: ProgressFile['attempts'], sessions?: SessionRecord[]): ProgressFile {
  return sessions ? { version: 1, attempts, sessions } : { version: 1, attempts };
}

describe('bankEvents', () => {
  it('counts a Kangaroo answer once however many skills it was stored under', () => {
    const t = at(1);
    const events = bankEvents(
      file({
        'NUM-01': [attempt('KA-0001', true, t)],
        'GEO-01': [attempt('KA-0001', true, t)],
      }),
      KA,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.subs.sort()).toEqual(['GEO-01', 'NUM-01']);
    expect(events[0]?.meta).toBe('3-4');
  });

  it('keeps the four banks apart even where ids share a shape', () => {
    // GEO-01 is a Kangaroo skill AND an AMC topic AND a SAT/ACT-style skill id.
    const f = file({
      'GEO-01': [attempt('KA-0001', true, at(1))],
      'AM-1001': [attempt('AM-1001', false, at(1))],
      'sat:SA-0001': [attempt('SA-0001', true, at(2))],
      'act:AC-0001': [attempt('AC-0001', false, at(2)), attempt('AC-0001', true, at(1))],
    });
    expect(bankEvents(f, KA).map((e) => e.problemId)).toEqual(['KA-0001']);
    expect(bankEvents(f, AMC).map((e) => e.problemId)).toEqual(['AM-1001']);
    expect(bankEvents(f, SAT).map((e) => e.problemId)).toEqual(['SA-0001']);
    expect(bankEvents(f, ACT).map((e) => e.correct)).toEqual([false, true]);
  });

  it('ignores Kangaroo buckets for skills the bank no longer has', () => {
    expect(bankEvents(file({ 'OLD-99': [attempt('KA-0001', true, at(1))] }), KA)).toEqual([]);
  });

  it('still counts an answer to a retired problem, just under no section', () => {
    const events = bankEvents(file({ 'AM-0999': [attempt('AM-0999', true, at(1))] }), AMC);
    expect(events).toHaveLength(1);
    expect(events[0]?.subs).toEqual([]);
  });
});

describe('sectionStats', () => {
  it('reports accuracy per section and per sub, untried ones included', () => {
    const f = file({
      'NUM-01': [attempt('KA-0001', true, at(3)), attempt('KA-0002', false, at(2))],
      'NUM-02': [attempt('KA-0002', false, at(2)), attempt('KA-0003', true, at(1))],
    });
    const stats = sectionStats(bankEvents(f, KA), KA);
    const num = stats.find((s) => s.id === 'NUM');
    expect(num).toMatchObject({ attempts: 3, correct: 2 });
    expect(num?.accuracy).toBeCloseTo(2 / 3);
    expect(num?.subs.map((s) => [s.id, s.attempts, s.correct])).toEqual([
      ['NUM-01', 2, 1],
      ['NUM-02', 2, 1],
    ]);
    expect(stats.find((s) => s.id === 'GEO')).toMatchObject({ attempts: 0, accuracy: null });
  });

  it('remembers where the student practised most, for the section-test link', () => {
    const f = file({
      'NUM-01': [
        attempt('KA-0003', true, at(3)),
        attempt('KA-0001', true, at(2)),
        attempt('KA-0002', true, at(1)),
      ],
    });
    expect(sectionStats(bankEvents(f, KA), KA)[0]?.meta).toBe('3-4');
  });
});

function stat(id: string, attempts: number, correct: number): SectionStat {
  return {
    id,
    name: id,
    attempts,
    correct,
    accuracy: attempts === 0 ? null : correct / attempts,
    subs: [],
    meta: null,
  };
}

describe('needsPractice', () => {
  it('needs at least five answers before calling a section weak', () => {
    expect(needsPractice([stat('A', 4, 0)])).toEqual([]);
    expect(needsPractice([stat('A', 5, 0)]).map((s) => s.id)).toEqual(['A']);
  });

  it('lists the weakest first, never a perfect section', () => {
    const out = needsPractice([
      stat('A', 10, 9),
      stat('B', 10, 3),
      stat('C', 6, 6),
      stat('D', 8, 4),
    ]);
    expect(out.map((s) => s.id)).toEqual(['B', 'D', 'A']);
  });

  it('lists three when three qualify, up to five while under 80%', () => {
    const strong = [stat('A', 10, 9), stat('B', 10, 9), stat('C', 10, 9), stat('D', 10, 9)];
    expect(needsPractice(strong)).toHaveLength(3);
    const weak = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id, i) => stat(id, 10, i));
    expect(needsPractice(weak).map((s) => s.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('sectionTestHref', () => {
  it('uses the agreed params for each bank', () => {
    expect(sectionTestHref('KA', { id: 'GEO', meta: '5-6' })).toBe(
      '/practice/section?level=5-6&strand=GEO',
    );
    expect(sectionTestHref('KA', { id: 'GEO', meta: null })).toBe('/practice/section?strand=GEO');
    expect(sectionTestHref('AMC', { id: 'NT', meta: 'AMC8' })).toBe(
      '/amc/section?contest=AMC8&area=NT',
    );
    expect(sectionTestHref('AMC', { id: 'NT', meta: 'BOTH' })).toBe(
      '/amc/section?contest=AMC10&area=NT',
    );
    expect(sectionTestHref('SAT', { id: 'PSD', meta: null })).toBe('/sat/section?domain=PSD');
    expect(sectionTestHref('ACT', { id: 'STAT', meta: null })).toBe('/act/section?domain=STAT');
  });
});

describe('weeklyStats', () => {
  it('starts weeks on a local Monday', () => {
    const monday = mondayOf(NOW);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(16);
    expect(mondayOf(new Date(2026, 10, 22, 23)).getDate()).toBe(16); // Sunday
  });

  it('returns twelve weeks oldest first, with gaps as null accuracy', () => {
    const events = bankEvents(
      file({
        'NUM-01': [
          attempt('KA-0001', true, at(0)),
          attempt('KA-0002', false, at(1)),
          attempt('KA-0003', true, at(14)),
          attempt('KA-0001', true, at(200)), // older than the window
        ],
      }),
      KA,
    );
    const weeks = weeklyStats(events, NOW);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toMatchObject({ start: '2026-11-16', attempts: 2, correct: 1 });
    expect(weeks.at(-3)).toMatchObject({ start: '2026-11-02', attempts: 1, accuracy: 1 });
    expect(weeks.at(-2)?.accuracy).toBeNull();
    expect(weeks.reduce((n, w) => n + w.attempts, 0)).toBe(3);
  });
});

describe('trendOf', () => {
  const week = (attempts: number, correct: number): WeekStat => ({
    start: 'x',
    attempts,
    correct,
    accuracy: attempts ? correct / attempts : null,
  });

  it('compares the last four weeks with the four before', () => {
    const weeks = [
      ...Array(4).fill(week(0, 0)),
      ...Array(4).fill(week(5, 2)),
      ...Array(4).fill(week(5, 4)),
    ];
    const trend = trendOf(weeks);
    expect(trend.earlier.accuracy).toBeCloseTo(0.4);
    expect(trend.recent.accuracy).toBeCloseTo(0.8);
    expect(trend.change).toBeCloseTo(0.4);
  });

  it('says nothing when either side is too thin', () => {
    const weeks = [...Array(8).fill(week(0, 0)), week(1, 1), ...Array(3).fill(week(10, 5))];
    expect(trendOf(weeks).change).toBeNull();
  });
});

describe('sessions and the bank summary', () => {
  const sessions: SessionRecord[] = [
    {
      kind: 'mock',
      exam: 'AMC10',
      at: at(5),
      score: 90,
      max: 150,
      correct: 15,
      total: 25,
      durationMs: 4_000_000,
    },
    {
      kind: 'section',
      exam: 'KA',
      section: 'GEO',
      at: at(3),
      score: 7,
      max: 10,
      correct: 7,
      total: 10,
      durationMs: 600_000,
    },
    {
      kind: 'section',
      exam: 'AMC8',
      section: 'NT',
      at: at(1),
      score: 6,
      max: 10,
      correct: 6,
      total: 10,
      durationMs: 700_000,
    },
  ];

  it('gives each bank its own exams, newest first', () => {
    const f = file({}, sessions);
    expect(bankSessions(f, 'AMC').map((s) => s.exam)).toEqual(['AMC8', 'AMC10']);
    expect(bankSessions(f, 'KA').map((s) => s.section)).toEqual(['GEO']);
    expect(bankSessions(f, 'SAT')).toEqual([]);
  });

  it('marks a bank active with answers or finished tests, inactive with neither', () => {
    expect(bankSummary(EMPTY_PROGRESS, SAT, NOW).active).toBe(false);
    expect(bankSummary(file({}, sessions), AMC, NOW).active).toBe(true);
    const summary = bankSummary(
      file({ 'sat:SA-0001': [attempt('SA-0001', true, at(1)), attempt('SA-0001', false, at(0))] }),
      SAT,
      NOW,
    );
    expect(summary).toMatchObject({ active: true, attempts: 2, correct: 1, sectionsTried: 1 });
    expect(percentLabel(summary.accuracy)).toBe('50%');
    expect(percentLabel(null)).toBe('-');
  });
});

describe('progressBanks (build-time data for the page)', () => {
  const banks = progressBanks();

  it('describes the four banks in tab order', () => {
    expect(banks.map((b) => b.bank)).toEqual(['KA', 'AMC', 'SAT', 'ACT']);
  });

  it('maps every problem id exactly once, and every sub to a real section sub', () => {
    for (const bank of banks) {
      const ids = bank.groups.flatMap((g) => g.ids);
      expect(new Set(ids).size, bank.bank).toBe(ids.length);
      const subs = new Set(bank.sections.flatMap((s) => s.subs.map((sub) => sub.id)));
      for (const group of bank.groups) {
        if (group.sub !== null) expect(subs.has(group.sub), `${bank.bank} ${group.sub}`).toBe(true);
      }
    }
  });

  it('ships ids and names only, no problem text', () => {
    const json = JSON.stringify(banks);
    expect(json).not.toMatch(/"statement"|"solutions"|"misconception"/);
  });
});

/* -------------------------------------------------------------------------- */
/* docs/08 item 8                                                              */
/* -------------------------------------------------------------------------- */

function timed(
  problemId: string,
  correct: boolean,
  when: string,
  extra: Pick<AttemptRecord, 'ms' | 'mode'> = {},
): AttemptRecord {
  return { ...attempt(problemId, correct, when), ...extra };
}

function session(over: Partial<SessionRecord> & Pick<SessionRecord, 'at'>): SessionRecord {
  return {
    kind: 'mock',
    exam: 'AMC8',
    score: 10,
    max: 25,
    correct: 10,
    total: 25,
    durationMs: 30 * 60_000,
    ...over,
  };
}

const AMC3: BankSpec = {
  ...AMC,
  groups: [
    { sub: 'ALG-01', meta: 'BOTH', ids: ['AM-0001'] },
    { sub: 'GEO-01', meta: 'AMC8', ids: ['AM-1001'] },
    { sub: 'GEO-01', meta: 'AMC12', ids: ['AM-2001'] },
  ],
};

describe('the exam filter', () => {
  it('parses ?exam=, falling back to all', () => {
    expect(parseExamFilter('amc10')).toBe('amc10');
    expect(parseExamFilter('aime')).toBe('all');
    expect(parseExamFilter(null)).toBe('all');
  });

  it('splits AMC answers by contest, BOTH counting for AMC 10 and 12', () => {
    expect(answerInExam('amc8', 'AMC', 'AMC8')).toBe(true);
    expect(answerInExam('amc8', 'AMC', 'BOTH')).toBe(false);
    expect(answerInExam('amc10', 'AMC', 'BOTH')).toBe(true);
    expect(answerInExam('amc12', 'AMC', 'BOTH')).toBe(true);
    expect(answerInExam('amc12', 'AMC', 'AMC8')).toBe(false);
    expect(answerInExam('ka', 'AMC', 'AMC8')).toBe(false);
    expect(answerInExam('all', 'SAT', null)).toBe(true);
  });

  it('collects answers across banks, oldest first, tagged with their bank', () => {
    const f = file({
      'NUM-01': [attempt('KA-0001', true, at(2))],
      'AM-1001': [attempt('AM-1001', false, at(3))],
      'AM-0001': [attempt('AM-0001', true, at(1))],
    });
    const all = examAnswers(f, [KA, AMC3], 'all');
    expect(all.map((a) => [a.problemId, a.bank])).toEqual([
      ['AM-1001', 'AMC'],
      ['KA-0001', 'KA'],
      ['AM-0001', 'AMC'],
    ]);
    expect(examAnswers(f, [KA, AMC3], 'amc8').map((a) => a.problemId)).toEqual(['AM-1001']);
    expect(examAnswers(f, [KA, AMC3], 'amc10').map((a) => a.problemId)).toEqual(['AM-0001']);
  });

  it('carries ms and mode through deduplication', () => {
    const t = at(1);
    const f = file({
      'NUM-01': [timed('KA-0001', true, t, { ms: 42_000, mode: 'test' })],
      'GEO-01': [timed('KA-0001', true, t, { ms: 42_000, mode: 'test' })],
    });
    const [event] = bankEvents(f, KA);
    expect(event).toMatchObject({ ms: 42_000, mode: 'test' });
  });

  it('filters sessions by the catalog exam and counts what each filter holds', () => {
    const f = file({ 'NUM-01': [attempt('KA-0001', true, at(1))] }, [
      session({ at: at(5), exam: 'AMC8' }),
      session({ at: at(2), exam: 'AMC10' }),
    ]);
    expect(examSessions(f, 'amc10').map((s) => s.exam)).toEqual(['AMC10']);
    expect(examSessions(f, 'all').map((s) => s.exam)).toEqual(['AMC10', 'AMC8']);
    const counts = examFilterCounts(f, [KA, AMC3, SAT, ACT]);
    expect(counts.all).toEqual({ answers: 1, tests: 2 });
    expect(counts.ka).toEqual({ answers: 1, tests: 0 });
    expect(counts.amc8).toEqual({ answers: 0, tests: 1 });
    expect(counts.sat).toEqual({ answers: 0, tests: 0 });
  });
});

describe('key stats', () => {
  it('compares the last 14 days with the 14 before, each side needing 5 answers', () => {
    const recent = [1, 2, 3, 4, 5, 6].map((d, i) => ({ at: at(d), correct: i < 5 }));
    const earlier = [15, 16, 17, 18, 19].map((d, i) => ({ at: at(d), correct: i < 2 }));
    const old = [40, 41].map((d) => ({ at: at(d), correct: true }));
    const result = compareRecent([...recent, ...earlier, ...old], NOW);
    expect(result.recent).toMatchObject({ attempts: 6, correct: 5 });
    expect(result.earlier).toMatchObject({ attempts: 5, correct: 2 });
    expect(result.change).toBeCloseTo(5 / 6 - 2 / 5);
    expect(compareRecent(recent, NOW).change).toBeNull();
    // Everything before, for a topic trend.
    expect(compareRecent([...recent, ...earlier, ...old], NOW, 14, null).earlier.attempts).toBe(7);
  });

  it('treats an attempt without a mode as practice', () => {
    const list = [{ mode: 'test' as const }, { mode: 'practice' as const }, {}];
    expect(practiceAnswers(list)).toHaveLength(2);
  });

  it('compares the last 3 tests with the first 3 only from 4 tests on', () => {
    const three = [0.4, 0.5, 0.6].map((r, i) =>
      session({ at: at(30 - i), score: r * 25, max: 25 }),
    );
    expect(compareTests(three)).toEqual({ taken: 3, first: null, last: null, change: null });
    const five = [
      ...three,
      session({ at: at(10), score: 0.7 * 150, max: 150, exam: 'AMC10' }),
      session({ at: at(5), score: 8, max: 10, kind: 'section' }),
    ];
    const result = compareTests([...five].reverse());
    expect(result.taken).toBe(5);
    expect(result.first).toBeCloseTo(0.5);
    expect(result.last).toBeCloseTo(0.7);
    expect(result.change).toBeCloseTo(0.2);
  });

  it('counts answers this week from Monday, and times only the timed ones', () => {
    const events = [
      { at: at(0, 9), ms: 30_000 },
      { at: at(2), ms: 60_000 }, // Monday 16 Nov
      { at: at(3) }, // Sunday 15 Nov, last week
    ];
    expect(answeredCounts(events, NOW)).toEqual({ total: 3, thisWeek: 2 });
    expect(timeStats(events)).toEqual({ timed: 2, totalMs: 90_000, averageMs: 45_000 });
    expect(timeStats([{}])).toEqual({ timed: 0, totalMs: 0, averageMs: null });
  });
});

describe('strengths and weak spots', () => {
  it('tags only with 5 answers: under 60% needs work, 80% and over strong', () => {
    expect(topicTag({ attempts: 4, correct: 0, accuracy: 0 })).toBeNull();
    expect(topicTag({ attempts: 5, correct: 2, accuracy: 0.4 })).toBe('needs-work');
    expect(topicTag({ attempts: 5, correct: 3, accuracy: 0.6 })).toBeNull();
    expect(topicTag({ attempts: 5, correct: 4, accuracy: 0.8 })).toBe('strong');
  });

  it('lists answered topics weakest first with time, trend, tag and the exam name', () => {
    const f = file({
      'AM-1001': [1, 2, 3, 4, 5].map((d) => timed('AM-1001', d > 3, at(d), { ms: 20_000 })),
      'AM-0001': [1, 2, 3, 4, 5].map((d) => attempt('AM-0001', d !== 1, at(d))),
    });
    const answers = examAnswers(f, [AMC3], 'all');
    const rows = topicRows(answers, [AMC3], 'all', NOW);
    expect(rows.map((r) => [r.id, r.accuracy, r.tag])).toEqual([
      ['GEO', 0.4, 'needs-work'],
      ['ALG', 0.8, 'strong'],
    ]);
    expect(rows[0]?.averageMs).toBe(20_000);
    expect(rows[1]?.averageMs).toBeNull();
    expect(focusTopic(rows)?.id).toBe('GEO');
    // One exam: that exam's name for the topic, and its contest for the section test.
    const amc8 = topicRows(examAnswers(f, [AMC3], 'amc8'), [AMC3], 'amc8', NOW);
    expect(amc8.map((r) => [r.id, r.meta])).toEqual([['GEO', 'AMC8']]);
    const amc10 = topicRows(examAnswers(f, [AMC3], 'amc10'), [AMC3], 'amc10', NOW);
    expect(amc10[0]?.meta).toBe('AMC10');
  });

  it('names no focus topic when every topic with enough answers is strong', () => {
    const f = file({ 'AM-0001': [1, 2, 3, 4, 5].map((d) => attempt('AM-0001', true, at(d))) });
    expect(focusTopic(topicRows(examAnswers(f, [AMC3], 'all'), [AMC3], 'all', NOW))).toBeNull();
  });
});

describe('activity calendar', () => {
  it('lays out 12 weeks of days, Monday first, with future days marked', () => {
    const days = dailyActivity(
      [
        { at: at(0, 10), correct: true },
        { at: at(0, 9), correct: false },
        { at: at(0, 17), correct: true }, // after NOW: not counted
        { at: at(9), correct: true },
        { at: at(200), correct: true },
      ],
      NOW,
    );
    expect(days).toHaveLength(84);
    expect(days[0]?.date).toBe('2026-08-31'); // a Monday
    expect(days.at(-1)?.date).toBe('2026-11-22'); // the Sunday after NOW
    const today = days.find((d) => d.date === '2026-11-18');
    expect(today).toMatchObject({ attempts: 2, correct: 1, future: false });
    expect(days.find((d) => d.date === '2026-11-19')?.future).toBe(true);
    expect(days.reduce((n, d) => n + d.attempts, 0)).toBe(3);
  });

  it('shades in quarters of the busiest day', () => {
    expect(activityLevel(0, 10)).toBe(0);
    expect(activityLevel(1, 10)).toBe(1);
    expect(activityLevel(5, 10)).toBe(2);
    expect(activityLevel(10, 10)).toBe(4);
  });
});

describe('scores over time and review', () => {
  it('gives one series per exam in catalog order, oldest first, as a share of max', () => {
    const series = scoreSeries([
      session({ at: at(1), exam: 'AMC10', score: 75, max: 150 }),
      session({ at: at(9), exam: 'KA', score: 60, max: 120 }),
      session({ at: at(3), exam: 'KA', score: 90, max: 120 }),
    ]);
    expect(series.map((s) => s.exam)).toEqual(['KA', 'AMC10']);
    expect(series[0]?.points.map((p) => p.ratio)).toEqual([0.5, 0.75]);
  });

  it('finds the questions of a test from its test-mode attempts at the finish time', () => {
    const done = at(2);
    const s = session({ at: done, exam: 'AMC8' });
    const f = file(
      {
        'AM-1001': [timed('AM-1001', true, done, { mode: 'test' })],
        'AM-0001': [
          timed('AM-0001', true, done, { mode: 'practice' }),
          timed('AM-0001', false, at(5), { mode: 'test' }),
        ],
        'NUM-01': [timed('KA-0001', true, done, { mode: 'test' })],
      },
      [s],
    );
    expect(sessionReviewIds(f, s)).toEqual(['AM-1001']);
    expect(sessionReview(f, s)).toEqual({
      href: '/amc/practice?bank=amc&ids=AM-1001&name=Review%3A+AMC+8+mock',
      questions: 1,
    });
  });

  it('falls back to the same kind of test when the questions were not recorded', () => {
    const f = file({});
    expect(sessionReview(f, session({ at: at(2), exam: 'AMC10' }))).toEqual({
      href: '/amc/mock?contest=AMC10',
      questions: 0,
    });
    expect(
      sessionReview(f, session({ at: at(2), exam: 'SAT', kind: 'section', section: 'ALG' })).href,
    ).toBe('/sat/section?domain=ALG');
  });
});

describe('progressSentence', () => {
  const none = {
    recent: { attempts: 0, correct: 0, accuracy: null },
    earlier: { attempts: 0, correct: 0, accuracy: null },
    change: null,
  };

  it('says scores rose and names the weakest topic', () => {
    const text = progressSentence({
      answers: 80,
      tests: { taken: 5, first: 0.5, last: 0.62, change: 0.12 },
      practice: none,
      topics: [
        {
          bank: 'KA',
          id: 'GEO',
          name: 'Geometry',
          meta: null,
          attempts: 25,
          correct: 13,
          accuracy: 0.52,
          averageMs: null,
          trend: none,
          tag: 'needs-work',
        },
      ],
      qualify: false,
    });
    expect(text).toBe(
      'Test scores have risen 12 points: your last 3 tests averaged 62% of the top score. Focus next on Geometry (52%).',
    );
  });

  it('is honest with very little data', () => {
    expect(
      progressSentence({
        answers: 3,
        tests: { taken: 1, first: null, last: null, change: null },
        practice: none,
        topics: [],
        qualify: true,
      }),
    ).toBe(
      'You have finished 1 test; after 4, this compares your latest scores with your first. A topic needs 5 answers before this can point at a weak spot.',
    );
    expect(
      progressSentence({
        answers: 0,
        tests: { taken: 0, first: null, last: null, change: null },
        practice: none,
        topics: [],
        qualify: true,
      }),
    ).toBe('Nothing answered here yet.');
  });

  it('reports a practice trend, down as plainly as up', () => {
    const text = progressSentence({
      answers: 30,
      tests: { taken: 0, first: null, last: null, change: null },
      practice: {
        recent: { attempts: 10, correct: 6, accuracy: 0.6 },
        earlier: { attempts: 10, correct: 7, accuracy: 0.7 },
        change: -0.1,
      },
      topics: [],
      qualify: true,
    });
    expect(text).toMatch(/^Practice accuracy is 60% over the last 14 days, down from 70%\./);
  });
});
