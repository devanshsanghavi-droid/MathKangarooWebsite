import {
  BANDS,
  POINT_VALUES,
  PROBLEM_ID_RE,
  SKILL_ID_RE,
  STRANDS,
  type Band,
  type Points,
  type Problem,
  type Strand,
} from './schemas';

/**
 * `/problems` URL state.
 *
 * Same principle as the Atlas: every filter lives in the URL, so a filtered view is a link you
 * can paste into a message to a student, it survives a reload, and Back undoes it. Parsing is
 * total - bad input narrows to nothing rather than throwing.
 */

export const SORTS = ['id', 'difficulty', 'newest'] as const;
export type ProblemSort = (typeof SORTS)[number];

export const PAGE_SIZE = 12;

/**
 * Status, as LeetCode and OnePrep split a bank: what you have not touched, what you tried and
 * missed, and what you have solved. It lives in the URL like every other filter, but the
 * SERVER cannot apply it - progress is in the student's own browser, never on our server - so
 * `matches()` ignores it and the page hands the status step to a client component.
 */
export const STATUSES = ['all', 'todo', 'attempted', 'solved'] as const;
export type ProblemStatusFilter = (typeof STATUSES)[number];

export interface ProblemQuery {
  bands: readonly Band[];
  points: readonly Points[];
  strands: readonly Strand[];
  skill: string | null;
  sort: ProblemSort;
  status: ProblemStatusFilter;
  page: number;
}

export const EMPTY_PROBLEM_QUERY: ProblemQuery = {
  bands: [],
  points: [],
  strands: [],
  skill: null,
  sort: 'id',
  status: 'all',
  page: 1,
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function values(raw: RawSearchParams, key: string): string[] {
  const value = raw[key];
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseProblemQuery(raw: RawSearchParams): ProblemQuery {
  const bands = values(raw, 'band').filter((v): v is Band =>
    (BANDS as readonly string[]).includes(v),
  );
  const points = values(raw, 'points')
    .map(Number)
    .filter((v): v is Points => (POINT_VALUES as readonly number[]).includes(v));
  const strands = values(raw, 'strand').filter((v): v is Strand =>
    (STRANDS as readonly string[]).includes(v),
  );
  const skill = values(raw, 'skill').find((v) => SKILL_ID_RE.test(v));
  const sort = values(raw, 'sort').find((v): v is ProblemSort =>
    (SORTS as readonly string[]).includes(v),
  );
  const status = values(raw, 'status').find((v): v is ProblemStatusFilter =>
    (STATUSES as readonly string[]).includes(v),
  );
  const page = Number(values(raw, 'page')[0] ?? '1');

  return {
    bands: [...new Set(bands)].sort((a, b) => BANDS.indexOf(a) - BANDS.indexOf(b)),
    points: [...new Set(points)].sort((a, b) => a - b),
    strands: [...new Set(strands)].sort(),
    skill: skill ?? null,
    sort: sort ?? 'id',
    status: status ?? 'all',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Serialise back to a query string.
 *
 * Values are sorted, so the same logical state always produces the same URL whatever order the
 * filters were clicked in. Without that, `?strand=GEO&strand=CNT` and `?strand=CNT&strand=GEO`
 * are two different cache entries and two different links for one view.
 */
export function toSearchParams(query: Partial<ProblemQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const band of [...(query.bands ?? [])].sort((a, b) => BANDS.indexOf(a) - BANDS.indexOf(b))) {
    params.append('band', band);
  }
  for (const points of [...(query.points ?? [])].sort((a, b) => a - b)) {
    params.append('points', String(points));
  }
  for (const strand of [...(query.strands ?? [])].sort()) params.append('strand', strand);
  if (query.skill) params.set('skill', query.skill);
  if (query.sort && query.sort !== 'id') params.set('sort', query.sort);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  return params;
}

export function problemsHref(query: Partial<ProblemQuery>): string {
  const params = toSearchParams(query).toString();
  return params ? `/problems?${params}` : '/problems';
}

/** Toggle one value of a multi-select filter, and reset to page 1 - the old page may not exist. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function isFiltered(query: ProblemQuery): boolean {
  return (
    query.bands.length > 0 ||
    query.points.length > 0 ||
    query.strands.length > 0 ||
    query.skill !== null ||
    query.status !== 'all'
  );
}

export function matches(problem: Problem, query: ProblemQuery): boolean {
  if (query.bands.length > 0 && !query.bands.includes(problem.band)) return false;
  if (query.points.length > 0 && !query.points.includes(problem.points)) return false;
  if (query.strands.length > 0) {
    const strand = problem.skills.primary.slice(0, 3) as Strand;
    if (!query.strands.includes(strand)) return false;
  }
  if (query.skill) {
    const tagged = [problem.skills.primary, ...problem.skills.secondary];
    if (!tagged.includes(query.skill)) return false;
  }
  return true;
}

/**
 * Sorting. "Difficulty" means the measured p-value, which is null until a problem has 30
 * first attempts - so uncalibrated problems sort last rather than pretending to be easy, and
 * the page says as much.
 */
export function sortProblems(problems: readonly Problem[], sort: ProblemSort): Problem[] {
  const byId = (a: Problem, b: Problem) => a.id.localeCompare(b.id);
  switch (sort) {
    case 'difficulty':
      return [...problems].sort((a, b) => {
        const pa = a.calibration.pValue;
        const pb = b.calibration.pValue;
        if (pa === null && pb === null) return byId(a, b);
        if (pa === null) return 1;
        if (pb === null) return -1;
        // Lower p-value means fewer students got it right, so hardest first.
        return pa - pb || byId(a, b);
      });
    case 'newest':
      return [...problems].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byId(a, b));
    default:
      return [...problems].sort(byId);
  }
}

export interface Page<T> {
  items: readonly T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
}

export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

export const isProblemId = (value: string): boolean => PROBLEM_ID_RE.test(value);
