import { describe, it, expect } from 'vitest';
import {
  BAND_LABEL,
  bandFor,
  benchmark,
  describe as summarise,
  percentileOf,
  quantile,
} from '../benchmark.ts';

const COHORT = Array.from({ length: 20 }, (_unused, index) => index * 5); // 0,5,...,95

describe('quantiles', () => {
  it('interpolates between neighbours', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
  });

  it('handles the degenerate sizes without throwing', () => {
    expect(quantile([7], 0.5)).toBe(7);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });

  it('summarises a distribution end to end', () => {
    const d = summarise([0, 10, 20, 30, 40]);
    expect(d).toMatchObject({ n: 5, min: 0, median: 20, max: 40 });
  });
});

describe('percentile', () => {
  it('puts the top value near 100 and the bottom near 0', () => {
    expect(percentileOf(95, COHORT)).toBeGreaterThan(95);
    expect(percentileOf(0, COHORT)).toBeLessThan(5);
  });

  it('counts ties as half, so an identical cohort sits at the middle', () => {
    // Everyone scored 50. Nobody is in the top quarter; they are all exactly average.
    expect(percentileOf(50, Array(20).fill(50))).toBe(50);
  });

  it('maps percentiles onto the four bands at the quartile boundaries', () => {
    expect(bandFor(99)).toBe('top-quarter');
    expect(bandFor(75)).toBe('top-quarter');
    expect(bandFor(74.9)).toBe('upper-middle');
    expect(bandFor(50)).toBe('upper-middle');
    expect(bandFor(49.9)).toBe('lower-middle');
    expect(bandFor(25)).toBe('lower-middle');
    expect(bandFor(24.9)).toBe('bottom-quarter');
  });
});

describe('the comparison a student is shown', () => {
  it('reports a band, never a rank', () => {
    const result = benchmark(80, COHORT, { unit: '%' });
    expect(result.suppressed).toBe(false);
    expect(result.band).toBe('top-quarter');
    // The wording must not contain an ordinal position. Leaderboards are out of scope.
    expect(result.message).not.toMatch(/\b\d+(st|nd|rd|th)\b/);
    expect(result.message).toContain(BAND_LABEL['top-quarter']);
  });

  it('suppresses entirely below ten students, because a quartile would be one person', () => {
    const result = benchmark(80, [10, 20, 30, 40, 50]);
    expect(result.suppressed).toBe(true);
    expect(result.percentile).toBeNull();
    expect(result.band).toBeNull();
    expect(result.message).toMatch(/Not enough students/);
    expect(result.message).toMatch(/Your own progress is still recorded/);
  });

  it('states the cohort size it is comparing against', () => {
    expect(benchmark(50, COHORT).message).toContain('20 students');
    expect(benchmark(50, COHORT).n).toBe(20);
  });

  it('never claims a comparison from an empty cohort', () => {
    expect(benchmark(50, []).suppressed).toBe(true);
  });
});
