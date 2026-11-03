import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROBLEM_QUERY,
  isFiltered,
  matches,
  PAGE_SIZE,
  paginate,
  parseProblemQuery,
  problemsHref,
  sortProblems,
  toggle,
  toSearchParams,
} from '../problem-query';
import { getAllProblems, getProblem } from '../content';
import type { Problem } from '../schemas';

const problems = getAllProblems();

function problemOrThrow(id: string): Problem {
  const problem = getProblem(id);
  if (!problem) throw new Error(`${id} is missing`);
  return problem;
}

describe('parseProblemQuery', () => {
  it('defaults to everything, sorted by id, page 1', () => {
    expect(parseProblemQuery({})).toEqual(EMPTY_PROBLEM_QUERY);
  });

  it('parses multi-select filters from repeated and comma-separated keys', () => {
    expect(parseProblemQuery({ band: ['5-6', '3-4'] }).bands).toEqual(['3-4', '5-6']);
    expect(parseProblemQuery({ points: '5,3' }).points).toEqual([3, 5]);
    expect(parseProblemQuery({ strand: 'GEO,CNT' }).strands).toEqual(['CNT', 'GEO']);
  });

  it('sorts bands in exam order, not alphabetically', () => {
    // "11-12" sorts before "3-4" as a string; that would be wrong in a filter chip row.
    expect(parseProblemQuery({ band: ['11-12', '3-4'] }).bands).toEqual(['3-4', '11-12']);
  });

  it('drops anything unrecognised', () => {
    expect(
      parseProblemQuery({ band: 'x', points: '9', strand: 'ZZZ', skill: 'nope', sort: 'random' }),
    ).toEqual(EMPTY_PROBLEM_QUERY);
  });

  it('rejects a nonsense page number rather than showing an empty list', () => {
    expect(parseProblemQuery({ page: '0' }).page).toBe(1);
    expect(parseProblemQuery({ page: '-3' }).page).toBe(1);
    expect(parseProblemQuery({ page: 'two' }).page).toBe(1);
  });

  it('accepts a skill id', () => {
    expect(parseProblemQuery({ skill: 'CNT-12' }).skill).toBe('CNT-12');
  });
});

describe('URLs are shareable and survive a reload - M1.7 acceptance', () => {
  it('round-trips every filter through a real URL', () => {
    const query = {
      bands: ['3-4', '5-6'] as const,
      points: [3, 5] as const,
      strands: ['CNT', 'GEO'] as const,
      skill: 'CNT-12',
      sort: 'newest' as const,
      page: 3,
    };
    const url = new URL(problemsHref(query), 'https://example.test');
    const raw: Record<string, string[]> = {};
    for (const key of new Set(url.searchParams.keys())) raw[key] = url.searchParams.getAll(key);
    expect(parseProblemQuery(raw)).toEqual(query);
  });

  it('produces a clean URL for the default state', () => {
    expect(problemsHref(EMPTY_PROBLEM_QUERY)).toBe('/problems');
  });

  it('is order-independent, so the same view is always the same link', () => {
    expect(problemsHref({ strands: ['GEO', 'CNT'] })).toBe(
      problemsHref({ strands: ['CNT', 'GEO'] }),
    );
  });

  it('omits the default sort and page 1 from the URL', () => {
    const params = toSearchParams({ sort: 'id', page: 1, bands: ['3-4'] });
    expect(params.has('sort')).toBe(false);
    expect(params.has('page')).toBe(false);
  });
});

describe('toggle', () => {
  it('adds and removes', () => {
    expect(toggle([], 'a')).toEqual(['a']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('isFiltered', () => {
  it('ignores sort and page', () => {
    expect(isFiltered({ ...EMPTY_PROBLEM_QUERY, sort: 'newest', page: 4 })).toBe(false);
  });

  it('notices every real filter', () => {
    expect(isFiltered({ ...EMPTY_PROBLEM_QUERY, bands: ['3-4'] })).toBe(true);
    expect(isFiltered({ ...EMPTY_PROBLEM_QUERY, points: [5] })).toBe(true);
    expect(isFiltered({ ...EMPTY_PROBLEM_QUERY, strands: ['CNT'] })).toBe(true);
    expect(isFiltered({ ...EMPTY_PROBLEM_QUERY, skill: 'CNT-12' })).toBe(true);
  });
});

describe('matches', () => {
  const problem = problemOrThrow('KA-0001'); // 3 pt, band 3-4, CNT-12 primary, CNT-01 secondary

  it('accepts everything when nothing is filtered', () => {
    for (const candidate of problems) {
      expect(matches(candidate, EMPTY_PROBLEM_QUERY), candidate.id).toBe(true);
    }
  });

  it('filters on band, points and strand', () => {
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, bands: ['3-4'] })).toBe(true);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, bands: ['5-6'] })).toBe(false);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, points: [3] })).toBe(true);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, points: [5] })).toBe(false);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, strands: ['CNT'] })).toBe(true);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, strands: ['GEO'] })).toBe(false);
  });

  it('matches a skill filter on secondary tags too, not just the primary', () => {
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, skill: 'CNT-01' })).toBe(true);
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, skill: 'GEO-01' })).toBe(false);
  });

  it('combines filters with AND', () => {
    expect(matches(problem, { ...EMPTY_PROBLEM_QUERY, bands: ['3-4'], points: [5] })).toBe(false);
  });
});

describe('sortProblems', () => {
  it('sorts by id by default, and is stable', () => {
    const ids = sortProblems(problems, 'id').map((p) => p.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('sorts newest first, breaking ties on id', () => {
    const sorted = sortProblems(problems, 'newest');
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (!previous || !current) continue;
      expect(previous.createdAt >= current.createdAt).toBe(true);
    }
  });

  it('puts uncalibrated problems last rather than treating null as easy', () => {
    const fake = (id: string, pValue: number | null): Problem => ({
      ...problemOrThrow('KA-0001'),
      id,
      calibration: { pValue, medianMs: null, n: 0 },
    });
    const sorted = sortProblems(
      [fake('KA-9001', null), fake('KA-9002', 0.8), fake('KA-9003', 0.2)],
      'difficulty',
    );
    expect(sorted.map((p) => p.id)).toEqual(['KA-9003', 'KA-9002', 'KA-9001']);
  });

  it('never loses or duplicates a problem', () => {
    for (const sort of ['id', 'difficulty', 'newest'] as const) {
      const sorted = sortProblems(problems, sort);
      expect(sorted).toHaveLength(problems.length);
      expect(new Set(sorted.map((p) => p.id)).size).toBe(problems.length);
    }
  });

  it('does not mutate its input', () => {
    const before = problems.map((p) => p.id);
    sortProblems(problems, 'newest');
    expect(problems.map((p) => p.id)).toEqual(before);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index);

  it('reports the window it returned', () => {
    const page = paginate(items, 2, 10);
    expect(page.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(page).toMatchObject({ page: 2, pageCount: 3, total: 25, from: 11, to: 20 });
  });

  it('clamps a page past the end back to the last page', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
  });

  it('clamps a page before the start back to the first', () => {
    expect(paginate(items, -4, 10).page).toBe(1);
  });

  it('handles an empty list without reporting page 0 of 0', () => {
    const page = paginate([], 1);
    expect(page).toMatchObject({ page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
    expect(page.items).toEqual([]);
  });

  it('covers every item exactly once across all pages', () => {
    const seen: number[] = [];
    const first = paginate(items, 1, PAGE_SIZE);
    for (let page = 1; page <= first.pageCount; page += 1) {
      seen.push(...paginate(items, page, PAGE_SIZE).items);
    }
    expect(seen).toEqual(items);
  });
});
