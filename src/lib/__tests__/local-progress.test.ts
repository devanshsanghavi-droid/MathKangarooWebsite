import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  attemptMs,
  attemptsFor,
  cleanAttempt,
  clearProgress,
  EMPTY_PROGRESS,
  isSaved,
  MAX_ATTEMPT_MS,
  MAX_SAVED,
  normalizeSaved,
  PROGRESS_EVENT,
  recordAmcAttempt,
  recordTestAttempt,
  savedIds,
  toggleSaved,
  withSaved,
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

/* -------------------------------------------------------------------------- */
/* docs/08 items 9 and 10: attempt timing and saved questions                  */
/* -------------------------------------------------------------------------- */

describe('attempt timing (docs/08 item 9)', () => {
  it('still parses attempts that have no timing', () => {
    const file = parseProgress(JSON.stringify({ version: 1, attempts: { S1: [attempt()] } }));
    expect(file.attempts.S1?.[0]).toEqual(attempt());
    expect(file.attempts.S1?.[0]).not.toHaveProperty('ms');
  });

  it('keeps valid ms and mode', () => {
    const raw = { version: 1, attempts: { S1: [attempt({ ms: 41_250, mode: 'practice' })] } };
    const file = parseProgress(JSON.stringify(raw));
    expect(file.attempts.S1?.[0]).toMatchObject({ ms: 41_250, mode: 'practice' });
  });

  it.each([
    ['negative', -1],
    ['fractional', 12.5],
    ['over 30 minutes', MAX_ATTEMPT_MS + 1],
    ['a string', '900'],
  ])('drops a %s ms but keeps the attempt', (_label, ms) => {
    const raw = { version: 1, attempts: { S1: [{ ...attempt(), ms, mode: 'test' }] } };
    const kept = parseProgress(JSON.stringify(raw)).attempts.S1?.[0];
    expect(kept).toBeDefined();
    expect(kept).not.toHaveProperty('ms');
    expect(kept?.mode).toBe('test');
  });

  it('drops an unknown mode and any unknown field', () => {
    const raw = { version: 1, attempts: { S1: [{ ...attempt(), mode: 'exam', extra: 'x' }] } };
    const kept = parseProgress(JSON.stringify(raw)).attempts.S1?.[0];
    expect(kept).toEqual(attempt());
  });

  it('recordAttempt rounds and caps ms, and drops unusable values', () => {
    const rounded = recordAttempt(
      ['S1'],
      attempt({ ms: 1234.6, mode: 'practice' }),
      EMPTY_PROGRESS,
    );
    expect(rounded.attempts.S1?.[0]).toMatchObject({ ms: 1235, mode: 'practice' });
    const capped = recordAttempt(['S1'], attempt({ ms: 99_999_999 }), EMPTY_PROGRESS);
    expect(capped.attempts.S1?.[0]?.ms).toBe(MAX_ATTEMPT_MS);
    const bad = recordAttempt(['S1'], attempt({ ms: Number.NaN }), EMPTY_PROGRESS);
    expect(bad.attempts.S1?.[0]).not.toHaveProperty('ms');
    expect(attemptMs(-5)).toBeUndefined();
  });

  it('AMC and SAT recorders pass timing through', () => {
    const amc = recordAmcAttempt(
      'AM-0001',
      3,
      { correct: true, hintsUsed: 0, at: at(1), ms: 5000, mode: 'test' },
      EMPTY_PROGRESS,
    );
    expect(amc.attempts['AM-0001']?.[0]).toMatchObject({ ms: 5000, mode: 'test' });
    const sat = recordTestAttempt(
      'SA-0001',
      'hard',
      { correct: false, hintsUsed: 1, at: at(1), ms: 70_000, mode: 'practice' },
      EMPTY_PROGRESS,
    );
    expect(sat.attempts['sat:SA-0001']?.[0]).toMatchObject({ ms: 70_000, mode: 'practice' });
  });

  it('cleanAttempt rejects a record missing a required field', () => {
    expect(cleanAttempt({ problemId: 'KA-0001', points: 3, correct: true, at: at(1) })).toBeNull();
    expect(cleanAttempt(null)).toBeNull();
  });
});

describe('saved questions (docs/08 item 10)', () => {
  it('starts with nothing saved and leaves the key out', () => {
    expect(savedIds(EMPTY_PROGRESS)).toEqual([]);
    expect(EMPTY_PROGRESS).not.toHaveProperty('saved');
  });

  it('toggles a question on and off through storage, firing the progress event', () => {
    const listener = vi.fn();
    window.addEventListener(PROGRESS_EVENT, listener);
    expect(toggleSaved('KA-0001')).toBe(true);
    expect(isSaved('KA-0001')).toBe(true);
    expect(savedIds()).toEqual(['KA-0001']);
    expect(toggleSaved('KA-0001')).toBe(false);
    expect(isSaved('KA-0001')).toBe(false);
    expect(readProgress()).not.toHaveProperty('saved');
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(PROGRESS_EVENT, listener);
  });

  it('forces a direction when asked', () => {
    expect(toggleSaved('AM-1001', true)).toBe(true);
    expect(toggleSaved('AM-1001', true)).toBe(true);
    expect(savedIds()).toEqual(['AM-1001']);
    expect(toggleSaved('AM-1001', false)).toBe(false);
  });

  it('accepts every bank id shape and ignores anything else', () => {
    for (const id of ['KA-0001', 'AM-0001', 'SA-0001', 'AC-0001']) toggleSaved(id, true);
    expect(toggleSaved('NUM-01', true)).toBe(false);
    expect(toggleSaved('sat:SA-0001', true)).toBe(false);
    expect(savedIds()).toEqual(['KA-0001', 'AM-0001', 'SA-0001', 'AC-0001']);
  });

  it('keeps saved ids when an attempt or a session is recorded', () => {
    toggleSaved('KA-0002', true);
    saveAttempt(['S1'], attempt());
    expect(savedIds()).toEqual(['KA-0002']);
  });

  it('parses, dedupes, validates and caps the saved list', () => {
    const ids = Array.from(
      { length: MAX_SAVED + 20 },
      (_, i) => `KA-${String(i).padStart(4, '0')}`,
    );
    const raw = { version: 1, attempts: {}, saved: ['KA-0001', 'KA-0001', 'bogus', 7, ...ids] };
    const file = parseProgress(JSON.stringify(raw));
    expect(file.saved).toHaveLength(MAX_SAVED);
    expect(new Set(file.saved).size).toBe(MAX_SAVED);
    expect(file.saved?.at(-1)).toBe(ids.at(-1));
    expect(normalizeSaved(['x', 'AC-0009'])).toEqual(['AC-0009']);
  });

  it('withSaved moves a re-saved id to the newest end', () => {
    let file = withSaved(EMPTY_PROGRESS, 'KA-0001', true);
    file = withSaved(file, 'KA-0002', true);
    file = withSaved(file, 'KA-0001', true);
    expect(file.saved).toEqual(['KA-0002', 'KA-0001']);
  });
});
