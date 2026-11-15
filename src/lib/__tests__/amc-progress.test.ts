import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROGRESS,
  amcAttemptsFor,
  amcProgressKey,
  parseProgress,
  recordAmcAttempt,
  recordAttempt,
  attemptsFor,
} from '../local-progress';
import { amcBankProgress, amcStatusOf, bankProgress, statusOfProblem } from '../progress-summary';

const at = (n: number) => new Date(Date.UTC(2026, 10, 14, 12, n)).toISOString();

describe('AMC attempts in the local progress store', () => {
  it('buckets an attempt under the AM id with points from the slot tier', () => {
    let file = recordAmcAttempt(
      'AM-0001',
      4,
      { correct: false, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    file = recordAmcAttempt('AM-0002', 15, { correct: true, hintsUsed: 0, at: at(2) }, file);
    file = recordAmcAttempt('AM-0003', 23, { correct: true, hintsUsed: 2, at: at(3) }, file);
    expect(Object.keys(file.attempts).sort()).toEqual(['AM-0001', 'AM-0002', 'AM-0003']);
    expect(amcAttemptsFor(file, 'AM-0001')[0]?.points).toBe(3);
    expect(amcAttemptsFor(file, 'AM-0002')[0]?.points).toBe(4);
    expect(amcAttemptsFor(file, 'AM-0003')[0]?.points).toBe(5);
  });

  it('refuses a non-AMC id as an AMC key', () => {
    expect(() => amcProgressKey('KA-0001')).toThrow(RangeError);
  });

  it('survives a storage round trip', () => {
    const file = recordAmcAttempt(
      'AM-0001',
      12,
      { correct: true, hintsUsed: 1, at: at(1) },
      EMPTY_PROGRESS,
    );
    expect(parseProgress(JSON.stringify(file))).toEqual(file);
  });

  it('leaves Kangaroo progress untouched alongside AMC attempts', () => {
    let file = recordAttempt(
      ['NUM-01', 'GEO-01'],
      { problemId: 'KA-0001', points: 3, correct: true, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    file = recordAmcAttempt('AM-0005', 18, { correct: false, hintsUsed: 0, at: at(2) }, file);
    expect(attemptsFor(file, 'GEO-01')).toHaveLength(1);
    expect(statusOfProblem(file, 'KA-0001', ['NUM-01', 'GEO-01'])).toBe('mastered');
    const kangaroo = bankProgress(
      file,
      [{ id: 'KA-0001', points: 3, skillIds: ['NUM-01', 'GEO-01'] }],
      91,
      '2026-11-14',
    );
    expect(kangaroo.solved).toBe(1);
    // The AM bucket is not a skill and must not inflate "skills touched".
    expect(kangaroo.skillsTouched).toBe(2);
  });
});

describe('AMC progress summary', () => {
  it('derives per-problem status from the AM bucket', () => {
    let file = recordAmcAttempt(
      'AM-0001',
      3,
      { correct: false, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    expect(amcStatusOf(file, 'AM-0001')).toBe('seen');
    file = recordAmcAttempt('AM-0001', 3, { correct: true, hintsUsed: 0, at: at(2) }, file);
    expect(amcStatusOf(file, 'AM-0001')).toBe('shaky');
    expect(amcStatusOf(file, 'AM-0009')).toBe('unseen');
  });

  it('summarises solved / attempted overall and by tier', () => {
    let file = recordAmcAttempt(
      'AM-0001',
      2,
      { correct: true, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    file = recordAmcAttempt('AM-0002', 14, { correct: false, hintsUsed: 0, at: at(2) }, file);
    const summary = amcBankProgress(file, [
      { id: 'AM-0001', slot: 2 },
      { id: 'AM-0002', slot: 14 },
      { id: 'AM-0003', slot: 22 },
      { id: 'AM-0004', slot: 25 },
    ]);
    expect(summary).toMatchObject({ total: 4, solved: 1, attempted: 1, untouched: 2, share: 0.25 });
    expect(summary.byTier.map((t) => [t.points, t.total, t.solved])).toEqual([
      [3, 1, 1],
      [4, 1, 0],
      [5, 2, 0],
    ]);
  });
});
