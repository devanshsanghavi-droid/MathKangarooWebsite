import { describe, it, expect } from 'vitest';
import {
  attemptsByProblem,
  decodeHomeProblem,
  encodeHomeProblem,
  pickUnsolved,
  potdWindow,
  practiceSetHref,
  previewText,
  summariseHome,
  type HomeProblem,
} from '../practice-home';
import type { ProgressFile } from '../local-progress';
import { filterAtlasSkills, searchToRaw, type AtlasSkill } from '../atlas-data';
import { parseLevel } from '../level-pref';

const problems: HomeProblem[] = [
  { id: 'KA-0001', band: '5-6', points: 3, strand: 'CNT', skill: 'CNT-12' },
  { id: 'KA-0002', band: '5-6', points: 4, strand: 'GEO', skill: 'GEO-10' },
  { id: 'KA-0003', band: '1-2', points: 5, strand: 'NUM', skill: 'NUM-01' },
];

const now = new Date('2026-11-14T12:00:00Z');

function attempt(problemId: string, correct: boolean, at: string) {
  return { problemId, points: 3 as const, correct, hintsUsed: 0, at };
}

describe('encoding the home rows', () => {
  it('round-trips a problem', () => {
    for (const problem of problems) {
      expect(decodeHomeProblem(encodeHomeProblem(problem))).toEqual(problem);
    }
  });

  it('drops a malformed row rather than throwing', () => {
    expect(decodeHomeProblem('KA-0001|5-6|9|CNT|CNT-12')).toBeNull();
    expect(decodeHomeProblem('KA-0001|13-14|3|CNT|CNT-12')).toBeNull();
    expect(decodeHomeProblem('nonsense')).toBeNull();
  });
});

describe('summariseHome', () => {
  it('treats an empty file as a new visitor', () => {
    const summary = summariseHome({ version: 1, attempts: {} }, problems, now);
    expect(summary.returning).toBe(false);
    expect(summary.all).toEqual({ total: 3, solved: 0, attempted: 0 });
    expect(summary.byBand['5-6'].total).toBe(2);
  });

  it('deduplicates an attempt stored under several skills and counts it once', () => {
    const shared = attempt('KA-0001', true, '2026-11-13T10:00:00Z');
    const file: ProgressFile = {
      version: 1,
      attempts: { 'CNT-12': [shared], 'CNT-03': [shared] },
    };
    expect(attemptsByProblem(file).get('KA-0001')).toHaveLength(1);
    const summary = summariseHome(file, problems, now);
    expect(summary.returning).toBe(true);
    expect(summary.all.solved).toBe(1);
    expect(summary.byStrand.CNT.solved).toBe(1);
    expect(summary.solvedThisWeek).toBe(1);
    expect(summary.last?.problemId).toBe('KA-0001');
  });

  it('counts a miss as attempted and an old solve outside this week', () => {
    const file: ProgressFile = {
      version: 1,
      attempts: {
        'GEO-10': [attempt('KA-0002', false, '2026-11-14T09:00:00Z')],
        'NUM-01': [attempt('KA-0003', true, '2026-10-01T09:00:00Z')],
      },
    };
    const summary = summariseHome(file, problems, now);
    expect(summary.all).toEqual({ total: 3, solved: 1, attempted: 1 });
    expect(summary.solvedThisWeek).toBe(0);
    expect(summary.last?.problemId).toBe('KA-0002');
  });

  it('ignores AMC attempts on the Kangaroo home', () => {
    const file: ProgressFile = {
      version: 1,
      attempts: { 'AM-0001': [attempt('AM-0001', true, '2026-11-14T09:00:00Z')] },
    };
    expect(summariseHome(file, problems, now).returning).toBe(false);
  });
});

describe('pickUnsolved', () => {
  it('puts never-tried problems before missed ones and never returns a solved one', () => {
    const buckets = new Map([
      ['KA-0001', 'solved' as const],
      ['KA-0002', 'attempted' as const],
    ]);
    expect(pickUnsolved(problems, buckets, 10, () => 0)).toEqual(['KA-0003', 'KA-0002']);
    expect(pickUnsolved(problems, buckets, 1, () => 0)).toEqual(['KA-0003']);
  });

  it('builds the practice-set URL', () => {
    expect(practiceSetHref(['KA-0001', 'KA-0002'])).toBe('/practice/set?ids=KA-0001,KA-0002');
  });
});

describe('Problem of the day window', () => {
  it('matches the bank-indexed-by-day rule for every day in the window', () => {
    const bank = ['a', 'b', 'c'];
    expect(potdWindow(bank, 10, 4)).toEqual(['b', 'c', 'a', 'b']);
    expect(potdWindow([], 10, 4)).toEqual([]);
  });

  it('cuts a long statement at a word boundary', () => {
    const long = 'word '.repeat(100);
    const preview = previewText(long, 50);
    expect(preview.length).toBeLessThanOrEqual(53);
    expect(preview.endsWith('...')).toBe(true);
    expect(previewText('short  text')).toBe('short text');
  });
});

describe('the Atlas filter', () => {
  const skill = (over: Partial<AtlasSkill>): AtlasSkill => ({
    id: 'CNT-01',
    name: 'x',
    strand: 'CNT',
    tier: 'core',
    definition: 'd',
    prerequisites: [],
    unlocks: [],
    bands: ['5-6'],
    problemCount: 1,
    pointTiers: [3],
    ...over,
  });
  const skills = [
    skill({ id: 'CNT-01' }),
    skill({ id: 'GEO-01', strand: 'GEO', bands: ['1-2'], problemCount: 0, pointTiers: [] }),
    skill({ id: 'NUM-01', strand: 'NUM', pointTiers: [3, 5] }),
  ];
  const none = { strands: [], band: null, points: null, hasProblems: false } as const;

  it('combines strand, level, points and coverage', () => {
    expect(filterAtlasSkills(skills, none)).toHaveLength(3);
    expect(filterAtlasSkills(skills, { ...none, strands: ['GEO'] }).map((s) => s.id)).toEqual([
      'GEO-01',
    ]);
    expect(filterAtlasSkills(skills, { ...none, band: '5-6' })).toHaveLength(2);
    expect(filterAtlasSkills(skills, { ...none, points: 5 }).map((s) => s.id)).toEqual(['NUM-01']);
    expect(filterAtlasSkills(skills, { ...none, hasProblems: true })).toHaveLength(2);
  });

  it('reads repeated query keys as a list', () => {
    expect(searchToRaw('?strand=CNT&strand=GEO&band=5-6')).toEqual({
      strand: ['CNT', 'GEO'],
      band: '5-6',
    });
  });
});

describe('the remembered level', () => {
  it('accepts only real levels', () => {
    expect(parseLevel('5-6')).toBe('5-6');
    expect(parseLevel('13-14')).toBeNull();
    expect(parseLevel(null)).toBeNull();
  });
});
