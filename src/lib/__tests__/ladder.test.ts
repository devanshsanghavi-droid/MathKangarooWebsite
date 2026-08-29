import { describe, it, expect } from 'vitest';
import { advance, LADDER_TARGET, ladderState, streakDots } from '../ladder.ts';
import type { AttemptRecord } from '../mastery.ts';

const IDS = ['KA-0001', 'KA-0002', 'KA-0003', 'KA-0004'];

function attempt(problemId: string, correct: boolean, day = 1): AttemptRecord {
  return {
    problemId,
    points: 3,
    correct,
    hintsUsed: 0,
    at: `2026-03-0${day}T10:00:00.000Z`,
  };
}

describe('a fresh ladder', () => {
  it('starts at the first problem with nothing solved', () => {
    expect(ladderState(IDS, [])).toEqual({
      streak: 0,
      complete: false,
      solved: 0,
      total: 4,
      startIndex: 0,
    });
  });

  it('is never complete when it has no problems on it', () => {
    // A tier with nothing written cannot be "finished", but it also must not block the quiz.
    expect(ladderState([], []).complete).toBe(false);
  });
});

describe('finishing a ladder', () => {
  it('takes three correct in a row', () => {
    const attempts = [attempt('KA-0001', true), attempt('KA-0002', true), attempt('KA-0003', true)];
    expect(ladderState(IDS, attempts).complete).toBe(true);
    expect(ladderState(IDS, attempts).streak).toBe(LADDER_TARGET);
  });

  it('is broken by a miss, however many came before it', () => {
    const attempts = [
      attempt('KA-0001', true),
      attempt('KA-0002', true),
      attempt('KA-0003', true),
      attempt('KA-0004', false),
    ];
    expect(ladderState(IDS, attempts).complete).toBe(false);
    expect(ladderState(IDS, attempts).streak).toBe(0);
  });

  it('counts distinct problems solved, not attempts', () => {
    const attempts = [attempt('KA-0001', true), attempt('KA-0001', true), attempt('KA-0001', true)];
    const state = ladderState(IDS, attempts);
    expect(state.solved).toBe(1);
    expect(state.complete).toBe(true);
  });
});

describe('where the runner opens', () => {
  it('opens on the first problem never solved', () => {
    expect(ladderState(IDS, [attempt('KA-0001', true)]).startIndex).toBe(1);
  });

  it('goes back to the top once everything has been solved', () => {
    const attempts = IDS.map((id) => attempt(id, true));
    expect(ladderState(IDS, attempts).startIndex).toBe(0);
  });

  it('does not skip a problem that was only ever answered wrong', () => {
    expect(ladderState(IDS, [attempt('KA-0001', false)]).startIndex).toBe(0);
  });
});

describe('streak dots', () => {
  it('always shows the target, filled from the left', () => {
    expect(streakDots(0)).toEqual(['empty', 'empty', 'empty']);
    expect(streakDots(2)).toEqual(['filled', 'filled', 'empty']);
  });

  it('does not overflow past the target', () => {
    expect(streakDots(9)).toEqual(['filled', 'filled', 'filled']);
    expect(streakDots(9)).toHaveLength(LADDER_TARGET);
  });
});

describe('advancing', () => {
  it('wraps rather than dead-ending on the last problem', () => {
    expect(advance(3, 4)).toBe(0);
    expect(advance(0, 4)).toBe(1);
  });

  it('survives an empty ladder', () => {
    expect(advance(0, 0)).toBe(0);
  });
});
