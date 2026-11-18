import { describe, it, expect } from 'vitest';
import type { AttemptRecord } from '../mastery';
import { EMPTY_PROGRESS, type ProgressFile, type SessionRecord } from '../local-progress';
import {
  bankEvents,
  bankSessions,
  bankSummary,
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
