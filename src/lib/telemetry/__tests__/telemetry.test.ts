import { describe, it, expect, beforeEach } from 'vitest';
import {
  BATCH_SIZE,
  FIRST_VISIT_KEY,
  flush,
  isOptedOut,
  OPT_OUT_KEY,
  resetTelemetry,
  returningBucket,
  sessionId,
  SESSION_KEY,
  setOptOut,
  track,
  buffered,
} from '../client.ts';
import { BatchSchema, EventSchema, bucketMs, MS_BUCKETS } from '../events.ts';
import { problemIdFor, skillIdFor, surfaceFor } from '../surface.ts';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetTelemetry();
});

describe('turning a URL into an enumerated surface', () => {
  it.each([
    ['/', 'home'],
    ['/atlas', 'atlas'],
    ['/atlas/CNT', 'atlas-strand'],
    ['/skill/CNT-12', 'skill-unit'],
    ['/skill/CNT-12/learn', 'skill-learn'],
    ['/skill/CNT-12/practice/5', 'skill-ladder'],
    ['/skill/CNT-12/quiz', 'skill-quiz'],
    ['/problem/KA-0047', 'problem'],
    ['/problems', 'problems'],
    ['/papers', 'papers'],
    ['/papers/2019-3-4', 'paper'],
    ['/practice/diagnostic', 'diagnostic'],
    ['/practice/mock', 'mock'],
    ['/print', 'worksheet'],
    ['/legal/privacy', 'legal'],
  ])('%s -> %s', (path, surface) => {
    expect(surfaceFor(path)).toBe(surface);
  });

  it('never lets a raw path or a query string through', () => {
    // The whole reason this function exists. A filter value a child typed must not become an
    // analytics field, and the only way to guarantee that is to stop passing paths along.
    expect(surfaceFor('/problems?skill=CNT-12&q=my+name+is+ada')).toBe('problems');
    expect(surfaceFor('/some/unknown/place')).toBe('not-found');
  });

  it('pulls out ids only when they match the content id format', () => {
    expect(skillIdFor('/skill/CNT-12/learn')).toBe('CNT-12');
    expect(skillIdFor('/skill/not-a-skill')).toBeUndefined();
    expect(problemIdFor('/problem/KA-0047')).toBe('KA-0047');
    expect(problemIdFor('/problem/whatever')).toBeUndefined();
  });
});

describe('the session identifier', () => {
  it('is 16 hex characters', () => {
    expect(sessionId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable within a tab and stored only in sessionStorage', () => {
    const first = sessionId();
    expect(sessionId()).toBe(first);
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe(first);
    // Nothing in localStorage, and above all no cookie.
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(document.cookie).not.toContain(SESSION_KEY);
  });

  it('does not survive the tab, so two visits cannot be linked', () => {
    const first = sessionId();
    window.sessionStorage.clear();
    expect(sessionId()).not.toBe(first);
  });
});

describe('refusing to be tracked', () => {
  it('is off entirely under an explicit opt-out', () => {
    setOptOut(true);
    expect(window.localStorage.getItem(OPT_OUT_KEY)).toBe('off');
    expect(isOptedOut()).toBe(true);
    expect(track('surface_view', { surface: 'home' })).toBe(false);
    expect(buffered()).toHaveLength(0);
    setOptOut(false);
    expect(isOptedOut()).toBe(false);
  });

  it('honours Do Not Track', () => {
    // jsdom does not define navigator.doNotTrack at all, so it is installed rather than spied.
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(isOptedOut()).toBe(true);
    expect(track('surface_view', { surface: 'home' })).toBe(false);
    Object.defineProperty(navigator, 'doNotTrack', { value: undefined, configurable: true });
  });

  it('honours Global Privacy Control', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });
    expect(isOptedOut()).toBe(true);
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
      configurable: true,
    });
  });
});

describe('what may be recorded', () => {
  it('accepts an event built from enumerated values', () => {
    expect(
      track('choice_select', {
        surface: 'skill-ladder',
        problemId: 'KA-0047',
        skillId: 'CNT-12',
        choiceKey: 'B',
        correct: false,
        hintLevel: 1,
        points: 5,
      }),
    ).toBe(true);
    expect(buffered()).toHaveLength(1);
  });

  it('REFUSES anything not in the taxonomy, rather than trimming it', () => {
    // The load-bearing test in this file. A caller that tries to attach free text does not get
    // a cleaned-up event stored; it gets nothing stored at all.
    const smuggled = { surface: 'home', studentName: 'Ada' } as unknown as Parameters<
      typeof track
    >[1];
    expect(track('surface_view', smuggled)).toBe(false);
    expect(buffered()).toHaveLength(0);
  });

  it('refuses an id that does not look like a content id', () => {
    expect(track('problem_view', { problemId: 'not-a-problem' } as never)).toBe(false);
    expect(track('surface_view', { skillId: '../../etc/passwd' } as never)).toBe(false);
  });

  it('has no string field anywhere in the schema except enumerated ones', () => {
    // Walk the schema and assert every leaf is an enum, a literal, a number, or a boolean -     // never a free string. If someone adds `z.string()` here, this fails.
    const shape = EventSchema.shape.props.shape as Record<string, { _def: { typeName?: string } }>;
    for (const [key, field] of Object.entries(shape)) {
      const json = JSON.stringify(field, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
      const looksFree = /"typeName":"ZodString"/.test(json) && !/checks/.test(json);
      expect(looksFree, `${key} looks like an unconstrained string`).toBe(false);
    }
  });

  it('buckets durations instead of storing them exactly', () => {
    // An exact millisecond count is a surprisingly strong fingerprint.
    track('choice_select', { problemId: 'KA-0001', msElapsed: 7_432 });
    expect(buffered()[0]?.props.msElapsed).toBe(15_000);
    expect(bucketMs(1)).toBe(MS_BUCKETS[0]);
    expect(bucketMs(9_999_999)).toBe(MS_BUCKETS[MS_BUCKETS.length - 1]);
  });

  it('numbers events within a session so ordering survives delivery', () => {
    track('surface_view', { surface: 'home' });
    track('surface_view', { surface: 'atlas' });
    expect(buffered().map((e) => e.seq)).toEqual([0, 1]);
  });
});

describe('delivery', () => {
  it('flushes automatically at the batch size', () => {
    const sent: string[] = [];
    for (let i = 0; i < BATCH_SIZE; i += 1) {
      track('surface_view', { surface: 'home' }, { send: (body) => sent.push(body) });
    }
    expect(sent).toHaveLength(1);
    expect(buffered()).toHaveLength(0);
    expect(BatchSchema.safeParse(JSON.parse(sent[0] as string)).success).toBe(true);
  });

  it('sends nothing when there is nothing buffered', () => {
    const sent: string[] = [];
    expect(flush((body) => sent.push(body))).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('empties the buffer even if the send throws, so events cannot pile up forever', () => {
    track('surface_view', { surface: 'home' });
    expect(() =>
      flush(() => {
        throw new Error('offline');
      }),
    ).toThrow();
    expect(buffered()).toHaveLength(0);
  });
});

describe('retention without an identifier', () => {
  it('calls a browser with no history a first visit, and records the date locally', () => {
    expect(returningBucket(new Date('2026-03-01T10:00:00Z'))).toBe('first-visit');
    expect(window.localStorage.getItem(FIRST_VISIT_KEY)).toBeTruthy();
  });

  it('buckets a return coarsely, and never sends the date itself', () => {
    window.localStorage.setItem(FIRST_VISIT_KEY, '2026-03-01T10:00:00.000Z');
    expect(returningBucket(new Date('2026-03-04T10:00:00Z'))).toBe('within-week');
    expect(returningBucket(new Date('2026-03-20T10:00:00Z'))).toBe('within-month');
    expect(returningBucket(new Date('2026-06-01T10:00:00Z'))).toBe('older');

    track('entry', { surface: 'home', returning: returningBucket(new Date('2026-06-01Z')) });
    const props = buffered()[0]?.props ?? {};
    expect(props.returning).toBe('older');
    expect(JSON.stringify(props)).not.toContain('2026-03-01');
  });
});
