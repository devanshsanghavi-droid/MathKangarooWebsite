import { describe, it, expect } from 'vitest';
import { dayNumber, formatDay, problemOfTheDay } from '../potd';
import { getAllProblems } from '../content';

const problems = getAllProblems();

describe('problemOfTheDay', () => {
  it('gives everyone the same problem on the same day', () => {
    const date = new Date('2026-08-28T00:00:00Z');
    const morning = problemOfTheDay(problems, new Date('2026-08-28T06:30:00Z'));
    const evening = problemOfTheDay(problems, new Date('2026-08-28T23:59:00Z'));
    expect(morning?.id).toBe(problemOfTheDay(problems, date)?.id);
    expect(evening?.id).toBe(morning?.id);
  });

  it('changes from one day to the next', () => {
    const today = problemOfTheDay(problems, new Date('2026-08-28T12:00:00Z'));
    const tomorrow = problemOfTheDay(problems, new Date('2026-08-29T12:00:00Z'));
    expect(today?.id).not.toBe(tomorrow?.id);
  });

  it('always returns a problem from the bank', () => {
    for (let offset = 0; offset < 120; offset += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset));
      const problem = problemOfTheDay(problems, date);
      expect(
        problems.some((p) => p.id === problem?.id),
        date.toISOString(),
      ).toBe(true);
    }
  });

  it('covers the whole bank over a long enough run', () => {
    const seen = new Set<string>();
    for (let offset = 0; offset < problems.length * 2; offset += 1) {
      const problem = problemOfTheDay(problems, new Date(Date.UTC(2026, 0, 1 + offset)));
      if (problem) seen.add(problem.id);
    }
    expect(seen.size).toBe(problems.length);
  });

  it('returns nothing for an empty bank rather than dividing by zero', () => {
    expect(problemOfTheDay([], new Date())).toBeUndefined();
  });
});

describe('dayNumber', () => {
  it('advances by exactly one per calendar day, in UTC', () => {
    const a = dayNumber(new Date('2026-08-28T00:00:00Z'));
    const b = dayNumber(new Date('2026-08-29T00:00:00Z'));
    expect(b - a).toBe(1);
  });

  it('ignores the time of day', () => {
    expect(dayNumber(new Date('2026-08-28T00:00:01Z'))).toBe(
      dayNumber(new Date('2026-08-28T23:59:59Z')),
    );
  });
});

describe('formatDay', () => {
  it('writes the date in words', () => {
    expect(formatDay(new Date('2026-08-28T12:00:00Z'))).toBe('Friday, 28 August 2026');
  });
});
