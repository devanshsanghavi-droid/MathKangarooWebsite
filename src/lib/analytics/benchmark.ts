import { PUBLISH_MIN_N } from './item-analysis';

/**
 * "How am I doing compared to everyone else?"
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS RETURNS A BAND AND NOT A RANK
 *
 * CLAUDE.md puts leaderboards explicitly out of scope, and the users are children. A rank
 * ("you are 14th of 60") does three things this project does not want: it makes the student's
 * position relative to named peers, it makes a bad week feel like a verdict, and it turns a
 * cohort of sixty into a table where the bottom is identifiable by elimination.
 *
 * A percentile band answers the same question — am I roughly where others are? — while being
 * unable to identify anyone, and stays stable when one person has an off day. Below
 * PUBLISH_MIN_N respondents nothing is reported at all: with eight students a quartile is one
 * person, and "bottom quarter" is then a name.
 * ---------------------------------------------------------------------------------------
 */

export const BANDS = ['top-quarter', 'upper-middle', 'lower-middle', 'bottom-quarter'] as const;
export type BenchmarkBand = (typeof BANDS)[number];

export const BAND_LABEL: Record<BenchmarkBand, string> = {
  'top-quarter': 'in the top quarter',
  'upper-middle': 'a little above the middle',
  'lower-middle': 'a little below the middle',
  'bottom-quarter': 'in the bottom quarter',
};

export interface Distribution {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface Benchmark {
  value: number;
  n: number;
  /** 0-100. Null when the cohort is too small to say anything. */
  percentile: number | null;
  band: BenchmarkBand | null;
  suppressed: boolean;
  /** Written for the student, not for the operator. */
  message: string;
}

/** Linear-interpolated quantile over a sorted copy. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] as number;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  if (lower === upper) return low;
  return low + (position - lower) * ((sorted[upper] as number) - low);
}

export function describe(values: readonly number[]): Distribution {
  return {
    n: values.length,
    min: values.length === 0 ? Number.NaN : Math.min(...values),
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: values.length === 0 ? Number.NaN : Math.max(...values),
  };
}

/**
 * The share of the cohort at or below `value`, as a 0-100 percentile.
 *
 * Ties count as half, which keeps a cohort where everyone scored identically at the 50th
 * percentile rather than putting all of them in the top quarter.
 */
export function percentileOf(value: number, cohort: readonly number[]): number {
  if (cohort.length === 0) return Number.NaN;
  const below = cohort.filter((other) => other < value).length;
  const equal = cohort.filter((other) => other === value).length;
  return ((below + equal / 2) / cohort.length) * 100;
}

export function bandFor(percentile: number): BenchmarkBand {
  if (percentile >= 75) return 'top-quarter';
  if (percentile >= 50) return 'upper-middle';
  if (percentile >= 25) return 'lower-middle';
  return 'bottom-quarter';
}

/**
 * Compare one student's figure against the cohort's.
 *
 * `cohort` should EXCLUDE the student being compared where that is knowable — comparing
 * someone against a distribution they are inside pulls the answer toward the middle, and on a
 * cohort of sixty that is a visible bias.
 */
export function benchmark(
  value: number,
  cohort: readonly number[],
  { minN = PUBLISH_MIN_N, unit = '' }: { minN?: number; unit?: string } = {},
): Benchmark {
  if (cohort.length < minN) {
    return {
      value,
      n: cohort.length,
      percentile: null,
      band: null,
      suppressed: true,
      message:
        `Not enough students have worked on this yet to compare against — ` +
        `${cohort.length} of the ${minN} needed. Your own progress is still recorded.`,
    };
  }

  const percentile = percentileOf(value, cohort);
  const band = bandFor(percentile);
  const median = quantile(cohort, 0.5);
  const rounded = (n: number) => Math.round(n * 10) / 10;

  return {
    value,
    n: cohort.length,
    percentile,
    band,
    suppressed: false,
    message:
      `You are ${BAND_LABEL[band]} of ${cohort.length} students, at ${rounded(value)}${unit} ` +
      `against a typical ${rounded(median)}${unit}.`,
  };
}
