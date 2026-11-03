import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  attemptsFor,
  clearProgress,
  EMPTY_PROGRESS,
  ladderAttempts,
  masteryStateFor,
  MAX_ATTEMPTS_PER_SKILL,
  parseProgress,
  problemProgress,
  PROGRESS_KEY,
  readProgress,
  recordAttempt,
  saveAttempt,
  skillProblemProgress,
  writeProgress,
} from '../local-progress.ts';
import { masteryFor } from '../local-progress.ts';
import { resolveMasteryState } from '../mastery-display.ts';
import type { AttemptRecord } from '../mastery.ts';

const at = (day: number) => `2026-03-${String(day).padStart(2, '0')}T10:00:00.000Z`;

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return { problemId: 'KA-0001', points: 3, correct: true, hintsUsed: 0, at: at(1), ...overrides };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('parsing whatever is in storage', () => {
  it('treats an empty slot as no progress', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
  });

  it('treats corrupt JSON as no progress rather than throwing', () => {
    // Every page with a mastery bar calls this. A parse error must not take the page down.
    expect(parseProgress('{not json')).toEqual(EMPTY_PROGRESS);
  });

  it('discards a file written by a future version', () => {
    expect(
      parseProgress(JSON.stringify({ version: 99, attempts: { 'NUM-01': [attempt()] } })),
    ).toEqual(EMPTY_PROGRESS);
  });

  it('drops entries that do not match the attempt shape', () => {
    const raw = JSON.stringify({
      version: 1,
      attempts: { 'NUM-01': [attempt(), { problemId: 'KA-0002' }, 'nonsense'] },
    });
    expect(parseProgress(raw).attempts['NUM-01']).toHaveLength(1);
  });

  it('caps a runaway history', () => {
    const many = Array.from({ length: MAX_ATTEMPTS_PER_SKILL + 25 }, (_u, i) =>
      attempt({ problemId: `KA-${i}` }),
    );
    const parsed = parseProgress(JSON.stringify({ version: 1, attempts: { 'NUM-01': many } }));
    expect(parsed.attempts['NUM-01']).toHaveLength(MAX_ATTEMPTS_PER_SKILL);
  });
});

describe('storage that may not be there', () => {
  it('returns empty progress when localStorage throws', () => {
    // Safari private browsing does exactly this.
    const spy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readProgress()).toEqual(EMPTY_PROGRESS);
    spy.mockRestore();
  });

  it('swallows a write failure rather than losing the page', () => {
    const spy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeProgress({ version: 1, attempts: {} })).not.toThrow();
    spy.mockRestore();
  });
});

describe('recording an attempt', () => {
  it('credits every skill the problem is tagged with', () => {
    const file = recordAttempt(['CNT-12', 'GEO-01'], attempt(), EMPTY_PROGRESS);
    expect(attemptsFor(file, 'CNT-12')).toHaveLength(1);
    expect(attemptsFor(file, 'GEO-01')).toHaveLength(1);
  });

  it('appends rather than replacing', () => {
    let file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-0001' }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-0002' }), file);
    expect(attemptsFor(file, 'CNT-12').map((a) => a.problemId)).toEqual(['KA-0001', 'KA-0002']);
  });

  it('round-trips through localStorage', () => {
    saveAttempt(['CNT-12'], attempt());
    expect(readProgress().attempts['CNT-12']).toHaveLength(1);
    expect(window.localStorage.getItem(PROGRESS_KEY)).toContain('CNT-12');
  });

  it('stores nothing that identifies the student', () => {
    // CLAUDE.md: the users are minors. No PII, and no network - this file has no fetch in it.
    saveAttempt(['CNT-12'], attempt());
    const stored = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}');
    const keys = new Set(Object.keys(stored.attempts['CNT-12'][0]));
    expect([...keys].sort()).toEqual(['at', 'correct', 'hintsUsed', 'points', 'problemId']);
  });

  it('clears completely on request', () => {
    saveAttempt(['CNT-12'], attempt());
    clearProgress();
    expect(readProgress()).toEqual(EMPTY_PROGRESS);
  });
});

describe('mastery over stored attempts', () => {
  it('is unseen with nothing recorded', () => {
    expect(masteryStateFor(EMPTY_PROGRESS, 'CNT-12', new Date(at(5)))).toBe('unseen');
  });

  it('uses the same state machine as the server will', () => {
    // Three correct across two days, no hint above the nudge - the mastery bar from
    // docs/01-DATA-MODEL.md §3.1, unchanged.
    let file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-1', at: at(1) }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-2', at: at(1) }), file);
    file = recordAttempt(['CNT-12'], attempt({ problemId: 'KA-3', at: at(2) }), file);
    expect(masteryStateFor(file, 'CNT-12', new Date(at(3)))).toBe('mastered');
  });
});

describe('what the interface actually claims', () => {
  it('does not call a student Proficient for getting their first answer wrong', () => {
    // The state machine says `shaky` (accuracy 0% is below 70%). docs/05 §3 maps shaky to
    // "Proficient", which would have the site congratulate a student on a single miss.
    const file = recordAttempt(['CNT-12'], attempt({ correct: false }), EMPTY_PROGRESS);
    expect(masteryFor(file, 'CNT-12', new Date(at(2))).state).toBe('shaky');
    expect(masteryStateFor(file, 'CNT-12', new Date(at(2)))).toBe('seen');
  });

  it('does call them Proficient once a harder version catches out something they can do', () => {
    let file = recordAttempt(
      ['CNT-12'],
      attempt({ problemId: 'KA-1', points: 3, correct: true, at: at(1) }),
      EMPTY_PROGRESS,
    );
    file = recordAttempt(
      ['CNT-12'],
      attempt({ problemId: 'KA-2', points: 5, correct: false, at: at(2) }),
      file,
    );
    expect(masteryStateFor(file, 'CNT-12', new Date(at(3)))).toBe('shaky');
  });

  it('leaves the other three states exactly as the machine computed them', () => {
    expect(resolveMasteryState('unseen', false)).toBe('unseen');
    expect(resolveMasteryState('seen', false)).toBe('seen');
    expect(resolveMasteryState('mastered', true)).toBe('mastered');
  });
});

describe('one rung of a ladder', () => {
  it('only counts attempts at that point value', () => {
    let file = recordAttempt(['CNT-12'], attempt({ points: 3 }), EMPTY_PROGRESS);
    file = recordAttempt(['CNT-12'], attempt({ points: 5 }), file);
    expect(ladderAttempts(file, 'CNT-12', 3)).toHaveLength(1);
    expect(ladderAttempts(file, 'CNT-12', 4)).toHaveLength(0);
  });
});

describe('per-problem progress', () => {
  it('is unseen with no attempt', () => {
    expect(problemProgress([])).toBe('unseen');
  });

  it('is seen while every attempt is wrong', () => {
    expect(problemProgress([attempt({ correct: false })])).toBe('seen');
  });

  it('is mastered on a clean first solve', () => {
    expect(problemProgress([attempt({ correct: true, hintsUsed: 1 })])).toBe('mastered');
  });

  it('is only proficient when the solve needed a hint past the nudge', () => {
    expect(problemProgress([attempt({ correct: true, hintsUsed: 2 })])).toBe('shaky');
  });

  it('is only proficient when a wrong answer came first', () => {
    expect(problemProgress([attempt({ correct: false }), attempt({ correct: true })])).toBe(
      'shaky',
    );
  });

  it('maps a whole skill in the order the problems were given', () => {
    const file = recordAttempt(
      ['CNT-12'],
      attempt({ problemId: 'KA-0002', correct: false }),
      EMPTY_PROGRESS,
    );
    expect(skillProblemProgress(file, 'CNT-12', ['KA-0001', 'KA-0002'])).toEqual([
      { problemId: 'KA-0001', state: 'unseen' },
      { problemId: 'KA-0002', state: 'seen' },
    ]);
  });
});
