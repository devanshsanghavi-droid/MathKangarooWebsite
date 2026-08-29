import {
  BANDS,
  POINT_VALUES,
  SKILL_ID_RE,
  STRANDS,
  type Band,
  type Points,
  type Problem,
  type Strand,
} from './schemas';

/**
 * The worksheet generator's state and selection, as pure functions.
 *
 * Everything lives in the URL, including the shuffle seed. That is the important part: a tutor
 * prints the worksheet, then prints the answer key, and the two must be the same worksheet. A
 * random shuffle that re-rolled on the second page load would quietly hand out a key that does
 * not match the sheet - and nobody would notice until a room full of students did.
 */

export const MAX_PROBLEMS = 30;
export const DEFAULT_COUNT = 10;

export interface WorksheetQuery {
  skills: readonly string[];
  bands: readonly Band[];
  points: readonly Points[];
  strands: readonly Strand[];
  count: number;
  seed: number;
  /** Include problems that need a figure. Off makes a sheet that photocopies cleanly. */
  figures: boolean;
  title: string;
}

export const DEFAULT_WORKSHEET: WorksheetQuery = {
  skills: [],
  bands: [],
  points: [],
  strands: [],
  count: DEFAULT_COUNT,
  seed: 1,
  figures: true,
  title: '',
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function values(raw: RawSearchParams, key: string): string[] {
  const value = raw[key];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseWorksheetQuery(raw: RawSearchParams): WorksheetQuery {
  const count = Number(values(raw, 'count')[0] ?? DEFAULT_COUNT);
  const seed = Number(values(raw, 'seed')[0] ?? 1);
  const figuresValue = values(raw, 'figures')[0];

  return {
    skills: [...new Set(values(raw, 'skill').filter((v) => SKILL_ID_RE.test(v)))].sort(),
    bands: [
      ...new Set(
        values(raw, 'band').filter((v): v is Band => (BANDS as readonly string[]).includes(v)),
      ),
    ].sort((a, b) => BANDS.indexOf(a) - BANDS.indexOf(b)),
    points: [
      ...new Set(
        values(raw, 'points')
          .map(Number)
          .filter((v): v is Points => (POINT_VALUES as readonly number[]).includes(v)),
      ),
    ].sort((a, b) => a - b),
    strands: [
      ...new Set(
        values(raw, 'strand').filter((v): v is Strand =>
          (STRANDS as readonly string[]).includes(v),
        ),
      ),
    ].sort(),
    count: Number.isInteger(count) && count > 0 ? Math.min(count, MAX_PROBLEMS) : DEFAULT_COUNT,
    seed: Number.isInteger(seed) && seed >= 0 ? seed : 1,
    figures: figuresValue === undefined ? true : figuresValue !== '0',
    title: (values(raw, 'title')[0] ?? '').slice(0, 60),
  };
}

export function toSearchParams(query: Partial<WorksheetQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const skill of [...(query.skills ?? [])].sort()) params.append('skill', skill);
  for (const band of [...(query.bands ?? [])].sort((a, b) => BANDS.indexOf(a) - BANDS.indexOf(b))) {
    params.append('band', band);
  }
  for (const points of [...(query.points ?? [])].sort((a, b) => a - b)) {
    params.append('points', String(points));
  }
  for (const strand of [...(query.strands ?? [])].sort()) params.append('strand', strand);
  if (query.count !== undefined && query.count !== DEFAULT_COUNT) {
    params.set('count', String(query.count));
  }
  if (query.seed !== undefined && query.seed !== 1) params.set('seed', String(query.seed));
  if (query.figures === false) params.set('figures', '0');
  if (query.title) params.set('title', query.title);
  return params;
}

export function printHref(query: Partial<WorksheetQuery>): string {
  const params = toSearchParams(query).toString();
  return params ? `/print?${params}` : '/print';
}

/**
 * mulberry32: a small, fast, well-distributed 32-bit PRNG.
 *
 * Written out here rather than pulled in as a dependency - it is nine lines, and the whole
 * point is that the sequence is fixed and inspectable so a seed in a URL means the same
 * worksheet on every machine, for ever.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, driven by the seeded generator. Never mutates the input. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const random = seededRandom(seed);
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

export function matchesWorksheet(problem: Problem, query: WorksheetQuery): boolean {
  if (query.bands.length > 0 && !query.bands.includes(problem.band)) return false;
  if (query.points.length > 0 && !query.points.includes(problem.points)) return false;
  if (query.strands.length > 0) {
    const strand = problem.skills.primary.slice(0, 3) as Strand;
    if (!query.strands.includes(strand)) return false;
  }
  if (query.skills.length > 0) {
    const tagged = [problem.skills.primary, ...problem.skills.secondary];
    if (!query.skills.some((skill) => tagged.includes(skill))) return false;
  }
  if (!query.figures && problem.figure !== null) return false;
  return true;
}

/**
 * The problems on the sheet: filtered, shuffled by the seed, cut to the count, then ordered
 * easiest first. A worksheet that opens with a 5-point question teaches a student to give up.
 */
export function selectProblems(
  problems: readonly Problem[],
  query: WorksheetQuery,
): { selected: Problem[]; available: number } {
  const eligible = [...problems]
    .filter((problem) => matchesWorksheet(problem, query))
    .sort((a, b) => a.id.localeCompare(b.id));

  const selected = shuffle(eligible, query.seed)
    .slice(0, query.count)
    .sort((a, b) => a.points - b.points || a.id.localeCompare(b.id));

  return { selected, available: eligible.length };
}
