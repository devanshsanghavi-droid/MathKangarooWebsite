import { describe, it, expect } from 'vitest';
import {
  activeDaysOf,
  bankProgress,
  localDay,
  statusOfProblem,
  streakFrom,
} from '../progress-summary.ts';
import { EMPTY_PROGRESS, recordAttempt } from '../local-progress.ts';
import type { AttemptRecord } from '../mastery.ts';
import type { Points } from '../schemas.ts';

// Built in LOCAL time: days are the student's calendar days, so a fixture written in UTC would
// land on a different day depending on the machine running the tests.
const at = (day: number, hour = 10) => new Date(2026, 2, day, hour).toISOString();

const attempt = (over: Partial<AttemptRecord> = {}): AttemptRecord => ({
  problemId: 'KA-0001',
  points: 3,
  correct: true,
  hintsUsed: 0,
  at: at(1),
  ...over,
});

const BANK = [
  { id: 'KA-0001', points: 3 as Points, skillIds: ['CNT-12', 'GEO-02'] },
  { id: 'KA-0002', points: 3 as Points, skillIds: ['CNT-12'] },
  { id: 'KA-0003', points: 4 as Points, skillIds: ['NUM-01'] },
  { id: 'KA-0004', points: 5 as Points, skillIds: ['NUM-01'] },
];

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    expect(streakFrom(['2026-03-05', '2026-03-04', '2026-03-03'], '2026-03-05')).toBe(3);
  });

  it('still counts when today has no attempt yet but yesterday did', () => {
    // Otherwise the streak appears to break at midnight for someone who has simply not
    // opened the site yet today, which punishes them for the clock rather than the habit.
    expect(streakFrom(['2026-03-04', '2026-03-03'], '2026-03-05')).toBe(2);
  });

  it('breaks after a fully missed day', () => {
    expect(streakFrom(['2026-03-03', '2026-03-02'], '2026-03-05')).toBe(0);
  });

  it('ignores a gap further back', () => {
    expect(streakFrom(['2026-03-05', '2026-03-04', '2026-03-01'], '2026-03-05')).toBe(2);
  });

  it('is zero with no history', () => {
    expect(streakFrom([], '2026-03-05')).toBe(0);
  });

  it('collects distinct days, newest first', () => {
    let file = recordAttempt(['CNT-12'], attempt({ at: at(3) }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ at: at(3, 18) }), file);
    file = recordAttempt(['CNT-12'], attempt({ at: at(5) }), file);
    expect(activeDaysOf(file)).toEqual(['2026-03-05', '2026-03-03']);
  });

  it("uses the student's calendar day, so one afternoon is one day", () => {
    // 15:00 and 23:00 local straddle UTC midnight anywhere in the Americas.
    let file = recordAttempt(['CNT-12'], attempt({ at: at(3, 15) }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ at: at(3, 23) }), file);
    expect(activeDaysOf(file)).toEqual(['2026-03-03']);
    expect(localDay(new Date(2026, 2, 3, 23, 30))).toBe('2026-03-03');
  });
});

describe('per-problem status', () => {
  it('is unseen with no attempts', () => {
    expect(statusOfProblem(EMPTY_PROGRESS, 'KA-0001', ['CNT-12'])).toBe('unseen');
  });

  it('does not treat one attempt on a multi-skill problem as several', () => {
    // The attempt is stored against every skill the problem teaches. Without deduplicating,
    // a clean first solve on a three-skill problem looks like three tries and downgrades.
    const file = recordAttempt(['CNT-12', 'GEO-02'], attempt({ correct: true }), EMPTY_PROGRESS);
    expect(statusOfProblem(file, 'KA-0001', ['CNT-12', 'GEO-02'])).toBe('mastered');
  });

  it('marks a wrong-then-right problem as solved but not cleanly', () => {
    let file = recordAttempt(['CNT-12'], attempt({ correct: false, at: at(1) }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ correct: true, at: at(2) }), file);
    expect(statusOfProblem(file, 'KA-0001', ['CNT-12'])).toBe('shaky');
  });

  it('ignores attempts on other problems', () => {
    const file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-0099' }), EMPTY_PROGRESS);
    expect(statusOfProblem(file, 'KA-0001', ['CNT-12'])).toBe('unseen');
  });
});

describe('whole-bank progress', () => {
  it('reports an empty bank honestly', () => {
    const p = bankProgress(EMPTY_PROGRESS, BANK, 91, '2026-03-05');
    expect(p).toMatchObject({
      problems: 4,
      solved: 0,
      attempted: 0,
      untouched: 4,
      skillsTouched: 0,
      streakDays: 0,
    });
  });

  it('counts solved, attempted and untouched without double counting', () => {
    let file = recordAttempt(
      ['CNT-12', 'GEO-02'],
      attempt({ problemId: 'KA-0001', correct: true, at: at(5) }),
      EMPTY_PROGRESS,
    );
    file = recordAttempt(
      ['NUM-01'],
      attempt({ problemId: 'KA-0003', points: 4, correct: false, at: at(5) }),
      file,
    );
    const p = bankProgress(file, BANK, 91, '2026-03-05');
    expect(p.solved).toBe(1);
    expect(p.attempted).toBe(1);
    expect(p.untouched).toBe(2);
    expect(p.solved + p.attempted + p.untouched).toBe(p.problems);
  });

  it('breaks the count down by point tier', () => {
    const file = recordAttempt(
      ['NUM-01'],
      attempt({ problemId: 'KA-0004', points: 5, correct: true, at: at(5) }),
      EMPTY_PROGRESS,
    );
    const p = bankProgress(file, BANK, 91, '2026-03-05');
    expect(p.byTier.find((t) => t.points === 5)).toMatchObject({ total: 1, solved: 1, share: 1 });
    expect(p.byTier.find((t) => t.points === 3)).toMatchObject({ total: 2, solved: 0, share: 0 });
  });

  it('judges first-try in time order, whatever order the skills were stored in', () => {
    // The wrong answer sits only in GEO-02's list, the later right answer in CNT-12's, so a
    // skill-ordered merge would read correct-then-wrong and call it solved first try.
    let file = recordAttempt(['GEO-02'], attempt({ correct: false, at: at(1) }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ correct: true, at: at(2) }), file);
    expect(statusOfProblem(file, 'KA-0001', ['CNT-12', 'GEO-02'])).toBe('shaky');
  });

  it('does not count retired skills as opened', () => {
    const file = recordAttempt(['RETIRED-01', 'CNT-12'], attempt(), EMPTY_PROGRESS);
    expect(bankProgress(file, BANK, 91, '2026-03-05').skillsTouched).toBe(1);
  });

  it('counts skills touched, not skills mastered', () => {
    const file = recordAttempt(['CNT-12', 'GEO-02'], attempt({ correct: false }), EMPTY_PROGRESS);
    expect(bankProgress(file, BANK, 91, '2026-03-05').skillsTouched).toBe(2);
  });

  it('never divides by zero on an empty tier', () => {
    const p = bankProgress(EMPTY_PROGRESS, [], 91, '2026-03-05');
    expect(p.byTier.every((t) => t.share === 0)).toBe(true);
  });
});
