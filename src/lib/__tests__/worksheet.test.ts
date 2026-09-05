import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORKSHEET,
  MAX_PROBLEMS,
  matchesWorksheet,
  parseWorksheetQuery,
  printHref,
  seededRandom,
  selectProblems,
  shuffle,
  toSearchParams,
} from '../worksheet';
import { getAllProblems } from '../content';
import { BANDS } from '../schemas.ts';

const problems = getAllProblems();

describe('parseWorksheetQuery', () => {
  it('defaults to ten problems, seed 1, figures on', () => {
    expect(parseWorksheetQuery({})).toEqual(DEFAULT_WORKSHEET);
  });

  it('reads every filter', () => {
    const query = parseWorksheetQuery({
      skill: 'CNT-12',
      band: '5-6',
      points: '3,5',
      strand: 'GEO',
      count: '15',
      seed: '42',
      figures: '0',
      title: 'Tuesday warm-up',
    });
    expect(query).toEqual({
      skills: ['CNT-12'],
      bands: ['5-6'],
      points: [3, 5],
      strands: ['GEO'],
      count: 15,
      seed: 42,
      figures: false,
      title: 'Tuesday warm-up',
    });
  });

  it('caps the count so nobody prints a hundred-page worksheet', () => {
    expect(parseWorksheetQuery({ count: '9999' }).count).toBe(MAX_PROBLEMS);
  });

  it('falls back to the default on a nonsense count or seed', () => {
    expect(parseWorksheetQuery({ count: '0' }).count).toBe(DEFAULT_WORKSHEET.count);
    expect(parseWorksheetQuery({ count: 'ten' }).count).toBe(DEFAULT_WORKSHEET.count);
    expect(parseWorksheetQuery({ seed: '-4' }).seed).toBe(1);
  });

  it('truncates a long title rather than letting it break the layout', () => {
    expect(parseWorksheetQuery({ title: 'x'.repeat(200) }).title).toHaveLength(60);
  });

  it('drops anything unrecognised', () => {
    const query = parseWorksheetQuery({ skill: 'nope', band: 'x', points: '9', strand: 'ZZZ' });
    expect(query.skills).toEqual([]);
    expect(query.bands).toEqual([]);
    expect(query.points).toEqual([]);
    expect(query.strands).toEqual([]);
  });
});

describe('the URL is the worksheet — M2.11 acceptance', () => {
  it('round-trips a full query', () => {
    const query = {
      skills: ['CNT-12', 'GEO-10'],
      bands: ['3-4'] as const,
      points: [3, 4] as const,
      strands: ['CNT'] as const,
      count: 15,
      seed: 7,
      figures: false,
      title: 'Week 3',
    };
    const url = new URL(printHref(query), 'https://example.test');
    const raw: Record<string, string[]> = {};
    for (const key of new Set(url.searchParams.keys())) raw[key] = url.searchParams.getAll(key);
    expect(parseWorksheetQuery(raw)).toEqual(query);
  });

  it('produces the same URL whatever order the filters were clicked in', () => {
    expect(printHref({ skills: ['GEO-10', 'CNT-12'] })).toBe(
      printHref({ skills: ['CNT-12', 'GEO-10'] }),
    );
  });

  it('omits every default, so the bare URL stays clean', () => {
    expect(printHref(DEFAULT_WORKSHEET)).toBe('/print');
    expect(toSearchParams({ count: 10, seed: 1, figures: true }).toString()).toBe('');
  });
});

describe('the shuffle is seeded, not random', () => {
  it('gives the same sequence for the same seed, every time', () => {
    const one = Array.from({ length: 5 }, seededRandom(99));
    const two = Array.from({ length: 5 }, seededRandom(99));
    expect(one).toEqual(two);
  });

  it('gives a different sequence for a different seed', () => {
    expect(Array.from({ length: 5 }, seededRandom(1))).not.toEqual(
      Array.from({ length: 5 }, seededRandom(2)),
    );
  });

  it('stays inside 0 and 1', () => {
    const random = seededRandom(12345);
    for (let index = 0; index < 500; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('permutes without losing or duplicating anything', () => {
    const items = Array.from({ length: 40 }, (_, index) => index);
    const mixed = shuffle(items, 5);
    expect([...mixed].sort((a, b) => a - b)).toEqual(items);
  });

  it('actually changes the order', () => {
    const items = Array.from({ length: 40 }, (_, index) => index);
    expect(shuffle(items, 5)).not.toEqual(items);
  });

  it('does not mutate its input', () => {
    const items = [1, 2, 3, 4, 5];
    shuffle(items, 3);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('selectProblems', () => {
  const base = { ...DEFAULT_WORKSHEET };

  it('returns the requested number when enough match', () => {
    expect(selectProblems(problems, { ...base, count: 12 }).selected).toHaveLength(12);
  });

  it('returns everything available when fewer match than were asked for', () => {
    const query = { ...base, skills: ['CNT-12'], count: 30 };
    const { selected, available } = selectProblems(problems, query);
    expect(selected.length).toBe(available);
    expect(available).toBeGreaterThan(0);
  });

  it('gives the identical sheet for the identical URL — the answer key must match', () => {
    const query = { ...base, seed: 77, count: 8 };
    const first = selectProblems(problems, query).selected.map((p) => p.id);
    const second = selectProblems(problems, query).selected.map((p) => p.id);
    expect(first).toEqual(second);
  });

  it('gives a different sheet for a different seed', () => {
    const a = selectProblems(problems, { ...base, seed: 1, count: 10 }).selected.map((p) => p.id);
    const b = selectProblems(problems, { ...base, seed: 2, count: 10 }).selected.map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  it('orders the sheet easiest first, so nobody opens with a 5-pointer', () => {
    const { selected } = selectProblems(problems, { ...base, count: 20 });
    const points = selected.map((p) => p.points);
    expect(points).toEqual([...points].sort((a, b) => a - b));
  });

  it('never repeats a problem on one sheet', () => {
    const { selected } = selectProblems(problems, { ...base, count: MAX_PROBLEMS });
    expect(new Set(selected.map((p) => p.id)).size).toBe(selected.length);
  });

  it('honours a band filter', () => {
    const { selected } = selectProblems(problems, { ...base, bands: ['3-4'], count: 30 });
    expect(selected.every((p) => p.band === '3-4')).toBe(true);
  });

  it('honours a point filter', () => {
    const { selected } = selectProblems(problems, { ...base, points: [5], count: 30 });
    expect(selected.every((p) => p.points === 5)).toBe(true);
  });

  it('honours a skill filter, matching secondary tags too', () => {
    const { selected } = selectProblems(problems, { ...base, skills: ['CNT-01'], count: 30 });
    expect(selected.length).toBeGreaterThan(0);
    for (const problem of selected) {
      expect([problem.skills.primary, ...problem.skills.secondary]).toContain('CNT-01');
    }
  });

  it('excludes every problem with a figure when figures are off', () => {
    // The point of the option: a sheet that photocopies cleanly on a bad machine.
    const { selected } = selectProblems(problems, { ...base, figures: false, count: 30 });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((p) => p.figure === null)).toBe(true);
  });

  it('combines filters with AND', () => {
    const query = { ...base, bands: ['5-6'] as const, points: [5] as const, count: 30 };
    const { selected } = selectProblems(problems, query);
    expect(selected.every((p) => p.band === '5-6' && p.points === 5)).toBe(true);
  });

  it('returns nothing, without throwing, when no problem matches', () => {
    // The empty band is derived, not hard-coded: this used to name 11-12, which stopped being
    // empty the moment problems were authored for that level.
    const emptyBand = BANDS.find((band) => !problems.some((problem) => problem.band === band));
    if (!emptyBand) throw new Error('every band now has problems - pick a new empty case');
    const query = { ...base, bands: [emptyBand], count: 10 };
    expect(selectProblems(problems, query)).toEqual({ selected: [], available: 0 });
  });

  it('matches a single problem the same way the filter function does', () => {
    for (const problem of problems.slice(0, 20)) {
      expect(matchesWorksheet(problem, DEFAULT_WORKSHEET)).toBe(true);
    }
  });
});

describe('the answer key has something to say about every wrong choice', () => {
  it('gives a misconception for all four distractors of every problem on a sheet', () => {
    const { selected } = selectProblems(problems, { ...DEFAULT_WORKSHEET, count: MAX_PROBLEMS });
    for (const problem of selected) {
      const wrong = problem.choices.filter((choice) => !choice.correct);
      expect(wrong, problem.id).toHaveLength(4);
      for (const choice of wrong) {
        expect(choice.misconception?.length ?? 0, `${problem.id} ${choice.key}`).toBeGreaterThan(
          29,
        );
      }
    }
  });
});
