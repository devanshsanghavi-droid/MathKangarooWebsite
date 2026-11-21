import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS_PER_SKILL, MAX_SAVED, type ProgressFile } from '../local-progress';
import { MAX_SYNC_BYTES, mergeProgress, parseUpload, sameProgress } from '../progress-sync';
import { hasSignedInHint } from '../signed-in-hint';

const attempt = (problemId: string, at: string, correct = true) => ({
  problemId,
  points: 3 as const,
  correct,
  hintsUsed: 0,
  at,
});

const file = (attempts: ProgressFile['attempts']): ProgressFile => ({ version: 1, attempts });

describe('mergeProgress', () => {
  it('keeps every attempt from both devices, once each, oldest first', () => {
    const phone = file({
      S1: [attempt('KA-0001', '2026-11-01'), attempt('KA-0002', '2026-11-03')],
    });
    const laptop = file({
      S1: [attempt('KA-0001', '2026-11-01'), attempt('KA-0003', '2026-11-02')],
      S2: [attempt('KA-0009', '2026-11-04')],
    });
    const merged = mergeProgress(phone, laptop);
    expect(merged.attempts.S1?.map((a) => a.problemId)).toEqual(['KA-0001', 'KA-0003', 'KA-0002']);
    expect(merged.attempts.S2).toHaveLength(1);
  });

  it('is order-independent', () => {
    const a = file({ S1: [attempt('KA-0001', '2026-11-01')] });
    const b = file({ S1: [attempt('KA-0002', '2026-11-02')] });
    expect(sameProgress(mergeProgress(a, b), mergeProgress(b, a))).toBe(true);
  });

  it('caps each skill at the newest attempts', () => {
    const many = Array.from({ length: MAX_ATTEMPTS_PER_SKILL + 5 }, (_, i) =>
      attempt(
        `KA-${String(i).padStart(4, '0')}`,
        `2026-11-01T00:00:${String(i).padStart(2, '0')}Z`,
      ),
    );
    const merged = mergeProgress(file({ S1: many }), file({}));
    expect(merged.attempts.S1).toHaveLength(MAX_ATTEMPTS_PER_SKILL);
    expect(merged.attempts.S1?.[0]?.problemId).toBe('KA-0005');
  });

  it('drops any field that is not part of an attempt', () => {
    const sneaky = file({ S1: [{ ...attempt('KA-0001', '2026-11-01'), email: 'x@y.z' } as never] });
    expect(JSON.stringify(mergeProgress(sneaky, file({})))).not.toContain('email');
  });
});

describe('parseUpload', () => {
  it('accepts a progress file and refuses anything else', () => {
    expect(
      parseUpload(JSON.stringify(file({ S1: [attempt('KA-0001', '2026-11-01')] }))),
    ).not.toBeNull();
    expect(parseUpload('not json')).toBeNull();
    expect(parseUpload('x'.repeat(MAX_SYNC_BYTES + 1))).toBeNull();
  });
});

describe('hasSignedInHint', () => {
  it('reads the hint cookie exactly', () => {
    expect(hasSignedInHint('ka_theme=dark; ka_signed_in=1')).toBe(true);
    expect(hasSignedInHint('ka_signed_in=0')).toBe(false);
    expect(hasSignedInHint('xka_signed_in=1')).toBe(false);
    expect(hasSignedInHint('')).toBe(false);
  });
});

describe('mergeProgress: timing and saved questions (docs/08 items 9 and 10)', () => {
  it('keeps valid ms and mode, and drops invalid ones', () => {
    const a = file({ S1: [{ ...attempt('KA-0001', '2026-11-01'), ms: 3000, mode: 'practice' }] });
    const b = file({
      S1: [{ ...attempt('KA-0002', '2026-11-02'), ms: -4, mode: 'nope' } as never],
    });
    const merged = mergeProgress(a, b);
    expect(merged.attempts.S1?.[0]).toMatchObject({ ms: 3000, mode: 'practice' });
    expect(merged.attempts.S1?.[1]).not.toHaveProperty('ms');
    expect(merged.attempts.S1?.[1]).not.toHaveProperty('mode');
  });

  it('prefers the timed copy of the same attempt, whichever side has it', () => {
    const plain = file({ S1: [attempt('KA-0001', '2026-11-01')] });
    const timed = file({ S1: [{ ...attempt('KA-0001', '2026-11-01'), ms: 9000, mode: 'test' }] });
    for (const merged of [mergeProgress(plain, timed), mergeProgress(timed, plain)]) {
      expect(merged.attempts.S1).toHaveLength(1);
      expect(merged.attempts.S1?.[0]).toMatchObject({ ms: 9000, mode: 'test' });
    }
  });

  it('unions saved ids, dedupes, validates, and leaves the key out when empty', () => {
    const a: ProgressFile = { version: 1, attempts: {}, saved: ['KA-0001', 'AM-0002'] };
    const b: ProgressFile = { version: 1, attempts: {}, saved: ['AM-0002', 'SA-0003', 'evil'] };
    expect(mergeProgress(a, b).saved).toEqual(['KA-0001', 'AM-0002', 'SA-0003']);
    expect(mergeProgress(file({}), file({}))).not.toHaveProperty('saved');
  });

  it('caps the merged saved list', () => {
    const ids = (from: number) =>
      Array.from({ length: 400 }, (_, i) => `KA-${String(from + i).padStart(4, '0')}`);
    const merged = mergeProgress(
      { version: 1, attempts: {}, saved: ids(0) },
      { version: 1, attempts: {}, saved: ids(400) },
    );
    expect(merged.saved).toHaveLength(MAX_SAVED);
  });

  it('round-trips saved ids and timing through an upload', () => {
    const upload: ProgressFile = {
      version: 1,
      attempts: { S1: [{ ...attempt('KA-0001', '2026-11-01'), ms: 100, mode: 'practice' }] },
      saved: ['KA-0001'],
    };
    expect(parseUpload(JSON.stringify(upload))).toEqual(upload);
  });
});
