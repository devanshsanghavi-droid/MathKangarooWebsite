import type { Band } from './schemas';
import { amcInContest, type AmcContest, type AmcFormulaContest } from './amc-tier';
import type { TestDifficulty } from './test-meta';

/**
 * Paper builders for the exam engine (docs/07 section 4). Pure and seeded: the same rows and
 * the same seed always give the same paper, so a test can pin one and a refresh never
 * reshuffles a sitting (the runner also saves the ids it drew).
 *
 * Every builder reports a shortfall instead of quietly building a short paper. A "mock" of 19
 * questions scored out of 25 would mean nothing, so the start screen says what is missing.
 *
 * Rows are the light index rows from public/data (bank-data.ts), never whole problems: a paper
 * is chosen before a single question file is fetched.
 */

export interface PaperResult {
  problemIds: string[];
  /** Questions the paper wanted and the bank could not supply. 0 when the paper is full. */
  shortfall: number;
}

/**
 * Seeded Fisher-Yates (mulberry32), the same generator as worksheet.ts. Copied rather than
 * imported because worksheet.ts pulls the Zod schemas in, and this module runs in the browser.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const a = out[index];
    const b = out[swap];
    if (a !== undefined && b !== undefined) {
      out[index] = b;
      out[swap] = a;
    }
  }
  return out;
}

const shuffle = seededShuffle;

const DIFFICULTY_RANK: Readonly<Record<TestDifficulty, number>> = { easy: 0, medium: 1, hard: 2 };

/**
 * Takes `count` items round-robin across `buckets` (difficulty tiers), starting at `offset`,
 * so a short pick still spreads across easy, medium and hard rather than taking all of one.
 * Mutates the bucket arrays: what is taken is gone.
 */
function takeBalanced<T>(buckets: T[][], count: number, offset = 0): T[] {
  const out: T[] = [];
  let turn = offset;
  while (out.length < count && buckets.some((bucket) => bucket.length > 0)) {
    const bucket = buckets[turn % buckets.length];
    turn += 1;
    const next = bucket?.shift();
    if (next !== undefined) out.push(next);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* AMC mock                                                                    */
/* -------------------------------------------------------------------------- */

export interface AmcPaperRow {
  id: string;
  contest: AmcContest;
  slot: number;
  area?: string;
}

export interface AmcPaperResult extends PaperResult {
  /** Positions filled from a neighbouring slot because the bank had nothing at that slot. */
  borrowed: number;
}

export const AMC_PAPER_SIZE = 25;

/** The rows that can sit on this paper: AMC 8 alone, BOTH on AMC 10 and AMC 12. */
export function amcPaperPool<T extends AmcPaperRow>(
  rows: readonly T[],
  paper: AmcFormulaContest,
): T[] {
  return rows.filter((row) => amcInContest(row.contest, paper));
}

/**
 * One problem per slot 1-25 where the bank has one; an empty slot borrows the nearest unused
 * problem from a neighbouring slot (the lower neighbour first, so a gap late in the paper is
 * not filled with something harder). Ordered by position, so the pacing rises like the real
 * paper.
 */
export function buildAmcMockPaper(
  rows: readonly AmcPaperRow[],
  paper: AmcFormulaContest,
  seed: number,
): AmcPaperResult {
  const pool = amcPaperPool(rows, paper).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length < AMC_PAPER_SIZE) {
    return { problemIds: [], shortfall: AMC_PAPER_SIZE - pool.length, borrowed: 0 };
  }
  const bySlot = new Map<number, string[]>();
  for (const row of shuffle(pool, seed)) {
    const list = bySlot.get(row.slot) ?? [];
    list.push(row.id);
    bySlot.set(row.slot, list);
  }
  const picked: Array<string | null> = Array.from({ length: AMC_PAPER_SIZE }, () => null);
  // Pass 1: every slot the bank covers takes its own problem.
  for (let slot = 1; slot <= AMC_PAPER_SIZE; slot += 1) {
    picked[slot - 1] = bySlot.get(slot)?.shift() ?? null;
  }
  // Pass 2: gaps borrow from the nearest slot with problems left over.
  let borrowed = 0;
  for (let slot = 1; slot <= AMC_PAPER_SIZE; slot += 1) {
    if (picked[slot - 1] !== null) continue;
    for (let distance = 1; distance < AMC_PAPER_SIZE * 2; distance += 1) {
      const id = bySlot.get(slot - distance)?.shift() ?? bySlot.get(slot + distance)?.shift();
      if (id) {
        picked[slot - 1] = id;
        borrowed += 1;
        break;
      }
    }
  }
  // Slots past 25 (none today) are reached by the distance search; anything still empty means
  // the pool had fewer usable rows than it claimed, which the length check rules out.
  const problemIds = picked.filter((id): id is string => id !== null);
  return { problemIds, shortfall: AMC_PAPER_SIZE - problemIds.length, borrowed };
}

/* -------------------------------------------------------------------------- */
/* SAT and ACT mocks                                                           */
/* -------------------------------------------------------------------------- */

export interface TestPaperRow {
  id: string;
  domain: string;
  difficulty: TestDifficulty;
}

/**
 * Domains per SAT module of 22: docs/07 section 3 asks for about 35% Algebra, 35% Advanced
 * Math, 15% Problem-Solving and Data Analysis, 15% Geometry and Trigonometry.
 */
export const SAT_MODULE_QUOTA: Readonly<Record<string, number>> = {
  ALG: 8,
  ADV: 8,
  PSD: 3,
  GEO: 3,
};
export const SAT_MODULE_SIZE = 22;
export const SAT_MODULES = 2;

/** ACT 45, spread across the five categories with a slight lean to Algebra and Functions. */
export const ACT_QUOTA: Readonly<Record<string, number>> = {
  NQ: 8,
  ALG: 10,
  FUN: 10,
  GEO: 9,
  STAT: 8,
};
export const ACT_PAPER_SIZE = 45;

function difficultyBuckets<T extends TestPaperRow>(rows: readonly T[]): T[][] {
  return [0, 1, 2].map((rank) => rows.filter((row) => DIFFICULTY_RANK[row.difficulty] === rank));
}

/** Easiest first; the seeded order is kept within a difficulty, so domains stay mixed. */
function risingDifficulty<T extends TestPaperRow>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[a.row.difficulty] - DIFFICULTY_RANK[b.row.difficulty] || a.index - b.index,
    )
    .map((entry) => entry.row);
}

/**
 * One block of questions: each domain's quota filled across difficulties, any domain that runs
 * short topped up from whatever is left (still balanced by difficulty), then sorted easiest
 * first. Takes from `available` in place.
 */
function fillBlock<T extends TestPaperRow>(
  available: T[],
  quota: Readonly<Record<string, number>>,
  size: number,
  offset: number,
): T[] {
  const block: T[] = [];
  for (const [domain, wanted] of Object.entries(quota)) {
    const buckets = difficultyBuckets(available.filter((row) => row.domain === domain));
    block.push(...takeBalanced(buckets, wanted, offset));
  }
  const taken = new Set(block.map((row) => row.id));
  const rest = available.filter((row) => !taken.has(row.id));
  if (block.length < size) {
    block.push(...takeBalanced(difficultyBuckets(rest), size - block.length, offset));
  }
  const used = new Set(block.map((row) => row.id));
  const remaining = available.filter((row) => !used.has(row.id));
  available.splice(0, available.length, ...remaining);
  return risingDifficulty(block);
}

export interface TestPaperResult extends PaperResult {
  /** Questions per module, in order: [22, 22] for the SAT, [45] for the ACT. */
  modules: number[];
}

/** SAT: two modules of 22, each with the domain mix and rising difficulty. */
export function buildSatMockPaper(rows: readonly TestPaperRow[], seed: number): TestPaperResult {
  const needed = SAT_MODULE_SIZE * SAT_MODULES;
  const modules = Array.from({ length: SAT_MODULES }, () => SAT_MODULE_SIZE);
  if (rows.length < needed) return { problemIds: [], shortfall: needed - rows.length, modules };
  const available = shuffle(
    [...rows].sort((a, b) => a.id.localeCompare(b.id)),
    seed,
  );
  const problemIds: string[] = [];
  for (let mod = 0; mod < SAT_MODULES; mod += 1) {
    problemIds.push(
      ...fillBlock(available, SAT_MODULE_QUOTA, SAT_MODULE_SIZE, mod).map((row) => row.id),
    );
  }
  return { problemIds, shortfall: needed - problemIds.length, modules };
}

/** ACT: 45 mixed, easiest first. */
export function buildActMockPaper(rows: readonly TestPaperRow[], seed: number): TestPaperResult {
  const modules = [ACT_PAPER_SIZE];
  if (rows.length < ACT_PAPER_SIZE) {
    return { problemIds: [], shortfall: ACT_PAPER_SIZE - rows.length, modules };
  }
  const available = shuffle(
    [...rows].sort((a, b) => a.id.localeCompare(b.id)),
    seed,
  );
  const problemIds = fillBlock(available, ACT_QUOTA, ACT_PAPER_SIZE, 0).map((row) => row.id);
  return { problemIds, shortfall: ACT_PAPER_SIZE - problemIds.length, modules };
}

/* -------------------------------------------------------------------------- */
/* Section tests                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A section-test candidate. `bucket` is the difficulty tier to balance across (0, 1, 2) and
 * `rank` is the order the question sits in on the paper (points, slot or difficulty).
 */
export interface SectionRow {
  id: string;
  bucket: number;
  rank: number;
}

/**
 * Up to `size` questions from one section, spread across difficulty tiers, easiest first.
 * The caller decides whether a short section is offered at all (SECTION_TEST_MIN).
 */
export function buildSectionPaper(
  rows: readonly SectionRow[],
  size: number,
  seed: number,
): PaperResult {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const shuffled = shuffle(sorted, seed);
  const buckets = [...new Set(shuffled.map((row) => row.bucket))]
    .sort((a, b) => a - b)
    .map((bucket) => shuffled.filter((row) => row.bucket === bucket));
  const picked = takeBalanced(buckets, size);
  const order = new Map(shuffled.map((row, index) => [row.id, index]));
  const problemIds = picked
    .sort((a, b) => a.rank - b.rank || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((row) => row.id);
  return { problemIds, shortfall: Math.max(0, size - problemIds.length) };
}

/** Kangaroo: one level, one strand (of the primary skill), balanced over 3 / 4 / 5 points. */
export function kaSectionRows(
  rows: readonly { id: string; band: Band; strand: string; points: number }[],
  band: Band,
  strand: string,
): SectionRow[] {
  return rows
    .filter((row) => row.band === band && row.strand === strand)
    .map((row) => ({ id: row.id, bucket: row.points, rank: row.points }));
}

/** AMC: one paper, one area, balanced over Early / Middle / Late and ordered by slot. */
export function amcSectionRows(
  rows: readonly { id: string; contest: AmcContest; slot: number; area: string }[],
  paper: AmcFormulaContest,
  area: string,
): SectionRow[] {
  return amcPaperPool(rows, paper)
    .filter((row) => row.area === area)
    .map((row) => ({
      id: row.id,
      bucket: row.slot <= 10 ? 0 : row.slot <= 20 ? 1 : 2,
      rank: row.slot,
    }));
}

/** SAT / ACT: one domain, balanced over easy / medium / hard. */
export function testSectionRows(rows: readonly TestPaperRow[], domain: string): SectionRow[] {
  return rows
    .filter((row) => row.domain === domain)
    .map((row) => ({
      id: row.id,
      bucket: DIFFICULTY_RANK[row.difficulty],
      rank: DIFFICULTY_RANK[row.difficulty],
    }));
}

/** A fresh seed per sitting. Not secret, only varied: the saved ids are what make it resumable. */
export function newSeed(now: Date = new Date()): number {
  return (now.getTime() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}
