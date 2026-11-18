import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROGRESS,
  MAX_SESSIONS,
  isTestProgressKey,
  parseProgress,
  recordAmcAttempt,
  recordAttempt,
  recordSession,
  recordTestAttempt,
  sessionsOf,
  testAttemptsByProblem,
  testAttemptsFor,
  testProgressKey,
  type ProgressFile,
  type SessionRecord,
} from '../local-progress';
import { mergeProgress, parseUpload, sameProgress } from '../progress-sync';
import { attemptsByProblem } from '../practice-home';
import { bankProgress, testStatusOf } from '../progress-summary';

const session = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  kind: 'mock',
  exam: 'SAT',
  at: '2026-11-17T10:00:00.000Z',
  score: 30,
  max: 44,
  correct: 30,
  total: 44,
  durationMs: 4_000_000,
  ...overrides,
});

const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();

describe('SAT / ACT progress keys', () => {
  it('namespaces each test under its slug', () => {
    expect(testProgressKey('SA-0001')).toBe('sat:SA-0001');
    expect(testProgressKey('AC-0042')).toBe('act:AC-0042');
    expect(() => testProgressKey('AM-0001')).toThrow(RangeError);
    expect(() => testProgressKey('ALG-01')).toThrow(RangeError);
    expect(isTestProgressKey('sat:SA-0001')).toBe(true);
    expect(isTestProgressKey('sat:AC-0001')).toBe(false);
    expect(isTestProgressKey('SA-0001')).toBe(false);
  });

  it('records points from difficulty in the test bucket only', () => {
    let file = recordTestAttempt(
      'SA-0001',
      'hard',
      { correct: true, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    file = recordTestAttempt('AC-0001', 'easy', { correct: false, hintsUsed: 1, at: at(2) }, file);
    expect(Object.keys(file.attempts).sort()).toEqual(['act:AC-0001', 'sat:SA-0001']);
    expect(testAttemptsFor(file, 'SA-0001')[0]?.points).toBe(5);
    expect(testAttemptsFor(file, 'AC-0001')[0]?.points).toBe(3);
    expect([...testAttemptsByProblem(file, 'SAT').keys()]).toEqual(['SA-0001']);
    expect(testStatusOf(file, 'SA-0001')).toBe('mastered');
    expect(testStatusOf(file, 'AC-0001')).toBe('seen');
    expect(testStatusOf(file, 'AC-0002')).toBe('unseen');
  });

  it('survives parseProgress and stays out of Kangaroo summaries', () => {
    let file = recordAttempt(
      ['NUM-01'],
      { problemId: 'KA-0001', points: 3, correct: true, hintsUsed: 0, at: at(1) },
      EMPTY_PROGRESS,
    );
    file = recordTestAttempt('SA-0001', 'medium', { correct: true, hintsUsed: 0, at: at(2) }, file);
    file = recordAmcAttempt('AM-0001', 3, { correct: true, hintsUsed: 0, at: at(3) }, file);
    const reparsed = parseProgress(JSON.stringify(file));
    expect(reparsed).toEqual(file);
    expect([...attemptsByProblem(reparsed).keys()]).toEqual(['KA-0001']);
    const summary = bankProgress(
      reparsed,
      [{ id: 'KA-0001', points: 3, skillIds: ['NUM-01'] }],
      1,
      '2026-01-01',
    );
    expect(summary.skillsTouched).toBe(1);
    expect(summary.solved).toBe(1);
  });
});

describe('sessions in the progress file', () => {
  it('is absent from a file with no sessions, so old files are unchanged', () => {
    const raw = JSON.stringify({ version: 1, attempts: {} });
    expect(parseProgress(raw)).toEqual({ version: 1, attempts: {} });
    expect('sessions' in parseProgress(raw)).toBe(false);
  });

  it('records, validates and keeps sessions across plain attempts', () => {
    let file = recordSession(session(), EMPTY_PROGRESS);
    file = recordSession(
      session({
        kind: 'section',
        exam: 'KA',
        section: 'GEO',
        at: at(5),
        score: 7,
        max: 10,
        correct: 7,
        total: 10,
      }),
      file,
    );
    // Invalid input is dropped, not thrown.
    file = recordSession(session({ correct: 50 }), file);
    file = recordSession({ ...session(), exam: 'GRE' } as unknown as SessionRecord, file);
    expect(file.sessions).toHaveLength(2);
    // Oldest first.
    expect(file.sessions?.map((s) => s.exam)).toEqual(['KA', 'SAT']);
    file = recordTestAttempt('SA-0001', 'easy', { correct: true, hintsUsed: 0, at: at(9) }, file);
    expect(file.sessions).toHaveLength(2);
    expect(sessionsOf(file, { exam: 'KA' })).toHaveLength(1);
    expect(sessionsOf(file, { kind: 'mock' })[0]?.exam).toBe('SAT');
    expect(parseProgress(JSON.stringify(file))).toEqual(file);
  });

  it('deduplicates by kind|exam|at and keeps the newest MAX_SESSIONS', () => {
    let file: ProgressFile = EMPTY_PROGRESS;
    for (let i = 0; i < MAX_SESSIONS + 5; i += 1)
      file = recordSession(session({ at: at(i) }), file);
    file = recordSession(session({ at: at(MAX_SESSIONS + 4), score: 1 }), file);
    expect(file.sessions).toHaveLength(MAX_SESSIONS);
    expect(file.sessions?.[0]?.at).toBe(at(5));
    expect(file.sessions?.at(-1)?.score).toBe(30);
  });

  it('parseProgress drops malformed sessions and unknown fields', () => {
    const raw = JSON.stringify({
      version: 1,
      attempts: {},
      sessions: [
        { ...session(), extra: 'smuggled', section: 'ALG' },
        { ...session(), at: 'not a date' },
        { ...session(), kind: 'quiz' },
        { ...session(), score: Number.NaN },
        'nope',
      ],
    });
    const parsed = parseProgress(raw);
    expect(parsed.sessions).toEqual([session({ section: 'ALG' })]);
  });

  it('sessions that are not an array are ignored', () => {
    const parsed = parseProgress(JSON.stringify({ version: 1, attempts: {}, sessions: {} }));
    expect(parsed).toEqual({ version: 1, attempts: {} });
  });
});

describe('merging sessions', () => {
  const phone: ProgressFile = {
    version: 1,
    attempts: {},
    sessions: [session({ at: at(1) }), session({ at: at(3), exam: 'ACT', max: 45, total: 45 })],
  };
  const laptop: ProgressFile = {
    version: 1,
    attempts: {},
    sessions: [session({ at: at(1) }), session({ at: at(2), kind: 'section', section: 'ADV' })],
  };

  it('unions by kind|exam|at, oldest first, order-independent', () => {
    const merged = mergeProgress(phone, laptop);
    expect(merged.sessions?.map((s) => s.at)).toEqual([at(1), at(2), at(3)]);
    expect(mergeProgress(laptop, phone)).toEqual(merged);
    expect(sameProgress(mergeProgress(phone, laptop), merged)).toBe(true);
  });

  it('treats the same finish time on a different exam or kind as different sessions', () => {
    const a: ProgressFile = { version: 1, attempts: {}, sessions: [session({ at: at(1) })] };
    const b: ProgressFile = {
      version: 1,
      attempts: {},
      sessions: [session({ at: at(1), exam: 'ACT' }), session({ at: at(1), kind: 'section' })],
    };
    expect(mergeProgress(a, b).sessions).toHaveLength(3);
  });

  it('copies known fields only and caps the union', () => {
    const smuggled = {
      version: 1,
      attempts: {},
      sessions: [{ ...session(), token: 'x' } as SessionRecord],
    };
    expect(mergeProgress(smuggled, { version: 1, attempts: {} }).sessions?.[0]).toEqual(session());
    const many = (offset: number): ProgressFile => ({
      version: 1,
      attempts: {},
      sessions: Array.from({ length: MAX_SESSIONS }, (_, i) => session({ at: at(offset + i) })),
    });
    const merged = mergeProgress(many(0), many(MAX_SESSIONS));
    expect(merged.sessions).toHaveLength(MAX_SESSIONS);
    expect(merged.sessions?.[0]?.at).toBe(at(MAX_SESSIONS));
  });

  it('leaves the key out when neither side has sessions, and parses uploads with them', () => {
    expect(
      'sessions' in mergeProgress({ version: 1, attempts: {} }, { version: 1, attempts: {} }),
    ).toBe(false);
    expect(parseUpload(JSON.stringify(phone))?.sessions).toHaveLength(2);
  });
});
