import { BANDS, STRANDS, type Band, type Points, type Strand } from './schemas';
import type { AttemptRecord } from './mastery';
import { problemProgress, type ProgressFile } from './local-progress';
import { bucketOf, type StatusBucket } from './progress-summary';
import { isAmcProblemId } from './amc-tier';

/**
 * The numbers on the Practice home (docs/06-V3-REDESIGN.md §4), as pure functions over the
 * signed-out progress file.
 *
 * The home page lists about a thousand problems. `statusOfProblem` in progress-summary.ts reads
 * one problem at a time through its skill buckets, which is the right shape for a list row but
 * would walk every bucket a thousand times here. So this inverts it: one pass over the file
 * groups every attempt by problem id, and each problem's status is then a single lookup. The
 * judging rule is the same one (`problemProgress`), fed the same deduplicated, time-ordered list.
 */

/** One Kangaroo problem as the home page needs it: built at build time, no statement. */
export interface HomeProblem {
  id: string;
  band: Band;
  points: Points;
  strand: Strand;
  /** Primary skill id. */
  skill: string;
}

/**
 * The rows travel to the browser as one short string each ("KA-0001|5-6|3|CNT|CNT-12") rather
 * than as objects, because with ~1,000 problems the repeated keys would be most of the payload.
 */
export function encodeHomeProblem(problem: HomeProblem): string {
  return [problem.id, problem.band, problem.points, problem.strand, problem.skill].join('|');
}

export function decodeHomeProblem(row: string): HomeProblem | null {
  const [id, band, points, strand, skill] = row.split('|');
  if (!id || !band || !points || !strand || !skill) return null;
  if (!(BANDS as readonly string[]).includes(band)) return null;
  if (!(STRANDS as readonly string[]).includes(strand)) return null;
  const pts = Number(points);
  if (pts !== 3 && pts !== 4 && pts !== 5) return null;
  return { id, band: band as Band, points: pts, strand: strand as Strand, skill };
}

/**
 * Every Kangaroo attempt in the file, grouped by problem id, deduplicated and oldest first.
 *
 * The same attempt is stored once per skill the problem is tagged with, so it is deduplicated on
 * its timestamp. AMC attempts (bucketed under AM ids) are left out: this is the Kangaroo home.
 */
export function attemptsByProblem(file: ProgressFile): Map<string, AttemptRecord[]> {
  const grouped = new Map<string, Map<string, AttemptRecord>>();
  for (const list of Object.values(file.attempts)) {
    for (const attempt of list) {
      if (isAmcProblemId(attempt.problemId)) continue;
      let byTime = grouped.get(attempt.problemId);
      if (!byTime) {
        byTime = new Map();
        grouped.set(attempt.problemId, byTime);
      }
      if (!byTime.has(attempt.at)) byTime.set(attempt.at, attempt);
    }
  }
  const out = new Map<string, AttemptRecord[]>();
  for (const [problemId, byTime] of grouped) {
    out.set(
      problemId,
      [...byTime.values()].sort((a, b) => a.at.localeCompare(b.at)),
    );
  }
  return out;
}

/** To do / attempted / solved for one problem, from the grouped attempts. */
export function bucketFor(
  grouped: ReadonlyMap<string, readonly AttemptRecord[]>,
  problemId: string,
): StatusBucket {
  return bucketOf(problemProgress(grouped.get(problemId) ?? []));
}

export interface GroupCount {
  total: number;
  solved: number;
  attempted: number;
}

function emptyCount(): GroupCount {
  return { total: 0, solved: 0, attempted: 0 };
}

export interface HomeSummary {
  /** True once the student has attempted any Kangaroo problem in this browser. */
  returning: boolean;
  all: GroupCount;
  byBand: Record<Band, GroupCount>;
  byStrand: Record<Strand, GroupCount>;
  /** Distinct problems first solved in the last seven days (today included). */
  solvedThisWeek: number;
  /** The most recent attempt, if any. */
  last: AttemptRecord | null;
  /** Problem id -> bucket, for every problem passed in. */
  buckets: Map<string, StatusBucket>;
}

const WEEK_MS = 7 * 86_400_000;

export function summariseHome(
  file: ProgressFile,
  problems: readonly HomeProblem[],
  now: Date,
): HomeSummary {
  const grouped = attemptsByProblem(file);
  const byBand = Object.fromEntries(BANDS.map((band) => [band, emptyCount()])) as Record<
    Band,
    GroupCount
  >;
  const byStrand = Object.fromEntries(STRANDS.map((strand) => [strand, emptyCount()])) as Record<
    Strand,
    GroupCount
  >;
  const all = emptyCount();
  const buckets = new Map<string, StatusBucket>();
  const known = new Set<string>();

  for (const problem of problems) {
    known.add(problem.id);
    const bucket = bucketFor(grouped, problem.id);
    buckets.set(problem.id, bucket);
    for (const group of [all, byBand[problem.band], byStrand[problem.strand]]) {
      group.total += 1;
      if (bucket === 'solved') group.solved += 1;
      if (bucket === 'attempted') group.attempted += 1;
    }
  }

  let last: AttemptRecord | null = null;
  let solvedThisWeek = 0;
  const since = now.getTime() - WEEK_MS;
  for (const [problemId, attempts] of grouped) {
    if (!known.has(problemId)) continue;
    const newest = attempts[attempts.length - 1];
    if (newest && (!last || newest.at > last.at)) last = newest;
    const firstCorrect = attempts.find((attempt) => attempt.correct);
    if (firstCorrect && new Date(firstCorrect.at).getTime() >= since) solvedThisWeek += 1;
  }

  return {
    returning: last !== null,
    all,
    byBand,
    byStrand,
    solvedThisWeek,
    last,
    buckets,
  };
}

/**
 * Up to `size` problems for a "Random unsolved" set: never-tried ones first, then tried and
 * missed, shuffled with the supplied random source (so a test can pass a fixed one).
 */
export function pickUnsolved(
  problems: readonly HomeProblem[],
  buckets: ReadonlyMap<string, StatusBucket>,
  size: number,
  random: () => number = Math.random,
): string[] {
  const shuffle = (ids: string[]): string[] => {
    const copy = [...ids];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const a = copy[i];
      const b = copy[j];
      if (a === undefined || b === undefined) continue;
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  };
  const todo = problems.filter((p) => (buckets.get(p.id) ?? 'todo') === 'todo').map((p) => p.id);
  const missed = problems.filter((p) => buckets.get(p.id) === 'attempted').map((p) => p.id);
  return [...shuffle(todo), ...shuffle(missed)].slice(0, size);
}

/** The practice-session URL for a list of ids (docs/06 §4, `/practice/set`). */
export function practiceSetHref(ids: readonly string[]): string {
  return `/practice/set?ids=${ids.join(',')}`;
}

/**
 * The window of Problem-of-the-day picks, worked out on the server: element i is the problem for
 * day `startDay + i`, using the same rule as `problemOfTheDay` in potd.ts (bank in id order,
 * indexed by the UTC day number).
 */
export function potdWindow<T>(problems: readonly T[], startDay: number, days: number): T[] {
  if (problems.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < days; i += 1) {
    const pick = problems[(startDay + i) % problems.length];
    if (pick !== undefined) out.push(pick);
  }
  return out;
}

/** A plain-text preview: whitespace collapsed, cut at a word boundary near `max` characters. */
export function previewText(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}...`;
}
