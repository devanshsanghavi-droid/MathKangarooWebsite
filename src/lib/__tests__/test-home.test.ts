import { describe, it, expect } from 'vitest';
import type { MasteryState } from '../mastery';
import { testGroupProgress, testMixedSetIds, type TestHomeProblem } from '../test-home';

const problems: TestHomeProblem[] = [
  { id: 'SA-0001', domain: 'ALG', skill: 'ALG-01', difficulty: 'hard' },
  { id: 'SA-0002', domain: 'ALG', skill: 'ALG-02', difficulty: 'easy' },
  { id: 'SA-0003', domain: 'ALG', skill: 'ALG-01', difficulty: 'medium' },
  { id: 'SA-0004', domain: 'ADV', skill: 'ADV-01', difficulty: 'easy' },
  { id: 'SA-0005', domain: 'ADV', skill: 'ADV-02', difficulty: 'hard' },
  { id: 'SA-0006', domain: 'PSD', skill: 'PSD-01', difficulty: 'medium' },
];
const none = new Map<string, MasteryState>();
const fixed = () => 0.5;

describe('testGroupProgress', () => {
  it('counts solved and attempted over any subset', () => {
    const statuses = new Map<string, MasteryState>([
      ['SA-0001', 'mastered'],
      ['SA-0002', 'seen'],
      ['SA-0004', 'shaky'],
    ]);
    expect(testGroupProgress(problems, statuses)).toEqual({ total: 6, solved: 2, attempted: 1 });
    expect(testGroupProgress([], statuses)).toEqual({ total: 0, solved: 0, attempted: 0 });
  });
});

describe('testMixedSetIds', () => {
  it('spreads a set across domains and orders it easy to hard', () => {
    const ids = testMixedSetIds(problems, none, { size: 3, random: fixed });
    const picked = ids.map((id) => problems.find((p) => p.id === id));
    expect(new Set(picked.map((p) => p?.domain))).toEqual(new Set(['ALG', 'ADV', 'PSD']));
    const rank = { easy: 0, medium: 1, hard: 2 };
    const ranks = picked.map((p) => (p ? rank[p.difficulty] : -1));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('takes unsolved questions before solved ones', () => {
    const statuses = new Map<string, MasteryState>(
      problems.filter((p) => p.id !== 'SA-0006').map((p) => [p.id, 'mastered' as MasteryState]),
    );
    expect(testMixedSetIds(problems, statuses, { size: 1, random: fixed })).toEqual(['SA-0006']);
    expect(testMixedSetIds(problems, statuses, { size: 10, random: fixed })).toHaveLength(6);
  });

  it('narrows to one domain and then spreads across its skills', () => {
    const ids = testMixedSetIds(problems, none, { size: 2, domain: 'ALG', random: fixed });
    const skills = ids.map((id) => problems.find((p) => p.id === id)?.skill);
    expect(new Set(skills)).toEqual(new Set(['ALG-01', 'ALG-02']));
    expect(testMixedSetIds(problems, none, { domain: 'GEO' })).toEqual([]);
  });
});
