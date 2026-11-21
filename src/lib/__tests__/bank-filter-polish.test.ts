import { describe, it, expect, beforeEach } from 'vitest';
import {
  EMPTY_FILTERS,
  bankFiltersToSearch,
  filterRows,
  hasStatus,
  idsIn,
  isFiltered,
  matchesQuery,
  missedSet,
  normalizeSearch,
  parseBankFilters,
  rowAttempts,
  rowsIgnoringStatus,
  savedSet,
  searchText,
  STATUS_OPTIONS,
  type BankRow,
  type BankTaxonomy,
} from '../bank-filter';
import {
  EMPTY_PROGRESS,
  readProgress,
  saveAmcAttempt,
  saveAttempt,
  saveTestAttempt,
  toggleSaved,
} from '../local-progress';

/** docs/08 items 10-11: Saved and Missed statuses, keyword search, quick practice ids. */

function row(id: string, extra: Partial<BankRow> = {}): BankRow {
  return {
    id,
    href: `/problem/${id}`,
    statement: 'A plain statement.',
    math: false,
    points: 3,
    tierLabel: null,
    levels: ['3-4'],
    levelLabel: 'Level 3-4',
    section: 'NUM',
    groups: ['NUM-01'],
    primaryName: 'Place value',
    tags: [],
    hasFigure: false,
    ...extra,
  };
}

const taxonomy: BankTaxonomy = {
  bank: 'ka',
  noun: 'problem',
  level: { label: 'Level', options: [{ value: 'all', label: 'All' }] },
  sections: { label: 'Skills', items: [] },
  tags: null,
  difficulty: { label: 'Difficulty', options: [{ points: 3, label: '3 points' }] },
  params: { group: 'skill', tag: 'type' },
};

const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 10, minute)).toISOString();

beforeEach(() => {
  window.localStorage.clear();
});

describe('status options', () => {
  it('add Saved and Missed after the three progress buckets', () => {
    expect(STATUS_OPTIONS.map((option) => option.label)).toEqual([
      'To do',
      'Attempted',
      'Solved',
      'Saved',
      'Missed',
    ]);
  });
});

describe('missed', () => {
  it('is a Kangaroo problem whose last attempt was wrong, deduplicated across skills', () => {
    const r = row('KA-0001', { groups: ['NUM-01', 'NUM-02'] });
    saveAttempt(r.groups, {
      problemId: r.id,
      points: 3,
      correct: false,
      hintsUsed: 0,
      at: at(1),
    });
    expect(rowAttempts('ka', readProgress(), r)).toHaveLength(1);
    expect(missedSet('ka', readProgress(), [r]).has(r.id)).toBe(true);
    saveAttempt(r.groups, { problemId: r.id, points: 3, correct: true, hintsUsed: 0, at: at(2) });
    expect(missedSet('ka', readProgress(), [r]).has(r.id)).toBe(false);
    saveAttempt(r.groups, { problemId: r.id, points: 3, correct: false, hintsUsed: 0, at: at(3) });
    expect(missedSet('ka', readProgress(), [r]).has(r.id)).toBe(true);
  });

  it('reads AMC, SAT and ACT attempts from their own keys', () => {
    saveAmcAttempt('AM-0001', 4, { correct: false, hintsUsed: 0, at: at(1) });
    saveTestAttempt('SA-0001', 'easy', { correct: false, hintsUsed: 0, at: at(1) });
    saveTestAttempt('AC-0001', 'easy', { correct: true, hintsUsed: 0, at: at(1) });
    const file = readProgress();
    expect(missedSet('amc', file, [row('AM-0001')]).size).toBe(1);
    expect(missedSet('sat', file, [row('SA-0001')]).size).toBe(1);
    expect(missedSet('act', file, [row('AC-0001')]).size).toBe(0);
    expect(missedSet('ka', EMPTY_PROGRESS, [row('KA-0001')]).size).toBe(0);
  });
});

describe('saved', () => {
  it('comes from the progress file', () => {
    toggleSaved('KA-0002');
    expect([...savedSet(readProgress())]).toEqual(['KA-0002']);
  });

  it('filters by Saved or Missed, either matching when both are ticked', () => {
    const rows = [row('KA-0001'), row('KA-0002'), row('KA-0003')];
    const marks = { saved: new Set(['KA-0001']), missed: new Set(['KA-0003']) };
    const statuses = new Map();
    expect(
      filterRows(rows, { ...EMPTY_FILTERS, status: ['saved'] }, statuses, marks).map((r) => r.id),
    ).toEqual(['KA-0001']);
    expect(
      filterRows(rows, { ...EMPTY_FILTERS, status: ['saved', 'missed'] }, statuses, marks).map(
        (r) => r.id,
      ),
    ).toEqual(['KA-0001', 'KA-0003']);
    expect(hasStatus(rows[1] as BankRow, 'todo', statuses, marks)).toBe(true);
    expect(hasStatus(rows[1] as BankRow, 'saved', statuses)).toBe(false);
  });
});

describe('keyword search', () => {
  it('normalizes KaTeX and punctuation away', () => {
    expect(normalizeSearch('If $\\frac{3}{x} = 1$, find X!')).toBe('if 3 x 1 find x');
  });

  it('matches every word against statement, skill names, tags and id', () => {
    const names = new Map([
      ['GEO-01', 'Angles in triangles'],
      ['T-CASES', 'Casework'],
    ]);
    const r = row('AM-0007', {
      statement: 'A ladder leans on a wall.',
      groups: ['GEO-01'],
      primaryName: 'Angles in triangles',
      tags: ['T-CASES'],
    });
    const text = searchText(r, names);
    expect(matchesQuery(text, 'ladder')).toBe(true);
    expect(matchesQuery(text, 'Triangles  WALL')).toBe(true);
    expect(matchesQuery(text, 'casework')).toBe(true);
    expect(matchesQuery(text, 'am-0007')).toBe(true);
    expect(matchesQuery(text, 'ladder circle')).toBe(false);
    expect(matchesQuery(text, '   ')).toBe(true);
  });

  it('filters rows, falling back to statement and name without a text map', () => {
    const rows = [row('KA-0001', { statement: 'Count the coins.' }), row('KA-0002')];
    const shown = filterRows(rows, { ...EMPTY_FILTERS, query: 'coins' }, new Map());
    expect(shown.map((r) => r.id)).toEqual(['KA-0001']);
    expect(isFiltered({ ...EMPTY_FILTERS, query: 'coins' })).toBe(true);
    expect(isFiltered({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
  });

  it('round-trips through the URL as q, with saved and missed statuses', () => {
    const filters = { ...EMPTY_FILTERS, query: 'coins', status: ['missed', 'saved'] as const };
    const search = bankFiltersToSearch({ ...filters, status: [...filters.status] }, taxonomy);
    expect(search).toBe('?status=saved,missed&q=coins');
    const back = parseBankFilters(search, taxonomy);
    expect(back.query).toBe('coins');
    expect(back.status).toEqual(['saved', 'missed']);
    expect(parseBankFilters('?q=' + 'x'.repeat(200), taxonomy).query).toHaveLength(80);
  });
});

describe('quick practice ids', () => {
  it('draw from the selection without the status filter, in order, capped', () => {
    const rows = [
      row('KA-0001', { points: 3 }),
      row('KA-0002', { points: 4 }),
      row('KA-0003', { points: 3 }),
      row('KA-0004', { points: 3 }),
    ];
    const marks = { missed: new Set(['KA-0001', 'KA-0002', 'KA-0003', 'KA-0004']) };
    const pool = rowsIgnoringStatus(
      rows,
      { ...EMPTY_FILTERS, points: [3], status: ['solved'] },
      new Map(),
      marks,
    );
    expect(pool.map((r) => r.id)).toEqual(['KA-0001', 'KA-0003', 'KA-0004']);
    expect(idsIn(pool, marks.missed, 2)).toEqual(['KA-0001', 'KA-0003']);
  });
});
