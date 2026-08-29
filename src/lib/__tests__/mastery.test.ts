import { describe, it, expect } from 'vitest';
import {
  calendarDay,
  computeMastery,
  daysOverdue,
  DECAY_DAYS,
  hasHigherTierMiss,
  isWeaker,
  MASTERY_STATES,
  meetsMasteryBar,
  recentAccuracy,
  trailingStreak,
  type AttemptRecord,
} from '../mastery';
import type { Points } from '../schemas';

const NOW = new Date('2026-03-01T12:00:00Z');

/** `a` = attempt. Day is a day-of-March number, so distinct days are easy to write. */
function a(
  day: number,
  correct: boolean,
  { points = 3 as Points, hints = 0, id = `KA-${String(day).padStart(4, '0')}` } = {},
): AttemptRecord {
  return {
    problemId: id,
    points,
    correct,
    hintsUsed: hints,
    at: `2026-03-${String(day).padStart(2, '0')}T10:00:00Z`,
  };
}

const state = (attempts: AttemptRecord[], due?: string | null) =>
  computeMastery({ attempts, ...(due === undefined ? {} : { due }), now: NOW }).state;

describe('the four states are exactly the ones the data model names', () => {
  it('matches docs/01-DATA-MODEL.md section 3.1', () => {
    expect([...MASTERY_STATES]).toEqual(['unseen', 'seen', 'shaky', 'mastered']);
  });
});

describe('unseen', () => {
  it('is the state with no attempts at all', () => {
    const result = computeMastery({ attempts: [], now: NOW });
    expect(result.state).toBe('unseen');
    expect(result.streak).toBe(0);
    expect(result.reasons[0]).toMatch(/no attempt/);
  });
});

describe('seen', () => {
  it('follows a single correct attempt', () => {
    expect(state([a(1, true)])).toBe('seen');
  });

  it('follows two correct attempts, which is short of the bar', () => {
    expect(state([a(1, true), a(2, true)])).toBe('seen');
  });

  it('survives one miss inside an otherwise accurate window', () => {
    // 4 of 5 correct is 80%, above the 70% floor, and no higher-tier miss - but the trailing
    // streak is only 2, so the mastery bar is not met either.
    const attempts = [a(1, true), a(2, true), a(3, false), a(4, true), a(5, true)];
    expect(recentAccuracy(attempts)).toBeCloseTo(0.8);
    expect(trailingStreak(attempts)).toBe(2);
    expect(state(attempts)).toBe('seen');
  });

  it('drops out of a mastered run the moment an attempt is missed', () => {
    expect(state([a(1, true), a(2, true), a(3, true), a(4, true), a(5, false)])).toBe('seen');
  });
});

describe('mastered', () => {
  it('needs three consecutive correct across two distinct days with no real hints', () => {
    expect(state([a(1, true), a(1, true, { id: 'x' }), a(2, true)])).toBe('mastered');
  });

  it('refuses three correct on a single day', () => {
    const sameDay = [a(1, true, { id: 'p' }), a(1, true, { id: 'q' }), a(1, true, { id: 'r' })];
    expect(meetsMasteryBar(sameDay)).toBe(false);
    expect(state(sameDay)).toBe('seen');
  });

  it('allows a level-1 nudge but not a level-2 hint', () => {
    expect(
      state([a(1, true, { hints: 1 }), a(2, true, { hints: 1 }), a(3, true, { hints: 1 })]),
    ).toBe('mastered');
    expect(state([a(1, true), a(2, true), a(3, true, { hints: 2 })])).toBe('seen');
  });

  it('applies all three conditions to the same three attempts', () => {
    // A clean two-day run in the past does not combine with a recent single-day run.
    const attempts = [
      a(1, true),
      a(2, true),
      a(3, true, { hints: 3 }),
      a(4, true, { id: 'p' }),
      a(4, true, { id: 'q' }),
    ];
    expect(meetsMasteryBar(attempts)).toBe(false);
  });

  it('needs the streak to be the most recent attempts, not any three in the history', () => {
    expect(state([a(1, true), a(2, true), a(3, true), a(4, false)])).toBe('seen');
  });
});

describe('shaky', () => {
  it('follows accuracy below 70% over the last five', () => {
    const attempts = [a(1, false), a(2, false), a(3, true), a(4, false), a(5, true)];
    expect(recentAccuracy(attempts)).toBeCloseTo(0.4);
    expect(state(attempts)).toBe('shaky');
  });

  it('uses only the last five, not the whole history', () => {
    const attempts = [
      a(1, false),
      a(2, false),
      a(3, false),
      a(4, false),
      a(5, true),
      a(6, true),
      a(7, true),
      a(8, true),
      a(9, true, { id: 'z' }),
    ];
    expect(recentAccuracy(attempts)).toBe(1);
  });

  it('follows a 4-point miss after a 3-point solve', () => {
    const attempts = [a(1, true, { points: 3 }), a(2, false, { points: 4 })];
    expect(hasHigherTierMiss(attempts)).toBe(true);
    expect(state(attempts)).toBe('shaky');
  });

  it('follows a 5-point miss after a 3-point solve', () => {
    expect(hasHigherTierMiss([a(1, true, { points: 3 }), a(2, false, { points: 5 })])).toBe(true);
  });

  it('does not fire on a higher-tier miss that came BEFORE any 3-point solve', () => {
    // Missing a 5-pointer having never solved a 3-pointer is just not knowing the skill yet.
    expect(hasHigherTierMiss([a(1, false, { points: 5 }), a(2, true, { points: 3 })])).toBe(false);
  });

  it('does not fire on a 3-point miss', () => {
    expect(hasHigherTierMiss([a(1, true, { points: 3 }), a(2, false, { points: 3 })])).toBe(false);
  });
});

describe('decay', () => {
  const cleanRun = [a(1, true), a(2, true), a(3, true)];

  it('leaves mastery alone when the review is not yet due', () => {
    expect(state(cleanRun, '2026-03-20T12:00:00Z')).toBe('mastered');
  });

  it('leaves mastery alone when it is overdue but inside the grace period', () => {
    const due = new Date(NOW.getTime() - (DECAY_DAYS - 1) * 86_400_000).toISOString();
    expect(state(cleanRun, due)).toBe('mastered');
  });

  it('drops mastery to shaky once the due date is more than 14 days past', () => {
    const due = new Date(NOW.getTime() - (DECAY_DAYS + 1) * 86_400_000).toISOString();
    expect(state(cleanRun, due)).toBe('shaky');
  });

  it('is exactly at the boundary: 14 days over is still mastered', () => {
    const due = new Date(NOW.getTime() - DECAY_DAYS * 86_400_000).toISOString();
    expect(state(cleanRun, due)).toBe('mastered');
  });

  it('says how overdue it is in the reason', () => {
    const due = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    const result = computeMastery({ attempts: cleanRun, due, now: NOW });
    expect(result.reasons[0]).toMatch(/30 days overdue/);
  });

  it('does nothing when there is no due date at all', () => {
    expect(daysOverdue(null, NOW)).toBeNull();
    expect(state(cleanRun, null)).toBe('mastered');
  });
});

describe('precedence between mastered and shaky', () => {
  it('lets a fresh clean run outrank older failures still inside the window', () => {
    // 3 of 5 correct is 60%, below the shaky floor - but the last three are a clean two-day run.
    const attempts = [a(1, false), a(2, false), a(3, true), a(4, true), a(5, true)];
    expect(recentAccuracy(attempts)).toBeCloseTo(0.6);
    expect(meetsMasteryBar(attempts)).toBe(true);
    expect(state(attempts)).toBe('mastered');
  });

  it('lets a fresh clean run outrank an older higher-tier miss', () => {
    const attempts = [
      a(1, true, { points: 3 }),
      a(2, false, { points: 5 }),
      a(3, true),
      a(4, true),
      a(5, true),
    ];
    expect(hasHigherTierMiss(attempts)).toBe(true);
    expect(state(attempts)).toBe('mastered');
  });
});

describe('streak', () => {
  it('counts only the trailing run', () => {
    expect(trailingStreak([a(1, true), a(2, false), a(3, true), a(4, true)])).toBe(2);
  });

  it('is zero when the last attempt was wrong', () => {
    expect(trailingStreak([a(1, true), a(2, true), a(3, false)])).toBe(0);
  });

  it('is reported alongside the state', () => {
    expect(computeMastery({ attempts: [a(1, true), a(2, true)], now: NOW }).streak).toBe(2);
  });
});

describe('ordering and helpers', () => {
  it('sorts attempts before judging them, whatever order they arrive in', () => {
    const forwards = [a(1, true), a(2, true), a(3, true)];
    const shuffled = [forwards[2], forwards[0], forwards[1]].filter(
      (x): x is AttemptRecord => x !== undefined,
    );
    expect(state(shuffled)).toBe('mastered');
  });

  it('reads a calendar day in UTC', () => {
    expect(calendarDay('2026-03-01T23:59:00Z')).toBe('2026-03-01');
    expect(calendarDay('2026-03-02T00:01:00Z')).toBe('2026-03-02');
  });

  it('ranks shaky as the weakest state, for the three-weakest-skills list', () => {
    expect(isWeaker('shaky', 'seen')).toBe(true);
    expect(isWeaker('seen', 'unseen')).toBe(true);
    expect(isWeaker('unseen', 'mastered')).toBe(true);
    expect(isWeaker('mastered', 'shaky')).toBe(false);
  });

  it('returns null accuracy for no attempts rather than dividing by zero', () => {
    expect(recentAccuracy([])).toBeNull();
  });
});

describe('every transition out of every state', () => {
  // A table rather than prose: each row is a history and the state it must produce.
  const cases: Array<[string, AttemptRecord[], string]> = [
    ['nothing -> unseen', [], 'unseen'],
    ['first correct -> seen', [a(1, true)], 'seen'],
    ['first wrong -> shaky', [a(1, false)], 'shaky'],
    ['seen -> mastered', [a(1, true), a(2, true), a(3, true)], 'mastered'],
    ['seen -> shaky by accuracy', [a(1, true), a(2, false), a(3, false)], 'shaky'],
    [
      'seen -> shaky by tier',
      [a(1, true, { points: 3 }), a(2, true, { points: 3 }), a(3, false, { points: 4 })],
      'shaky',
    ],
    ['mastered -> seen after a miss', [a(1, true), a(2, true), a(3, true), a(4, false)], 'seen'],
    [
      'shaky -> mastered after a clean run',
      [a(1, false), a(2, true), a(3, true), a(4, true)],
      'mastered',
    ],
  ];

  it.each(cases)('%s', (_label, attempts, expected) => {
    expect(state(attempts)).toBe(expected);
  });
});
