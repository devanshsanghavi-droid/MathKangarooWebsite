import { describe, it, expect } from 'vitest';
import {
  atlasHref,
  describeQuery,
  EMPTY_QUERY,
  isFiltered,
  parseAtlasQuery,
  toSearchParams,
  withStrandToggled,
} from '../atlas-params';

describe('parseAtlasQuery', () => {
  it('returns the unfiltered graph view for an empty query', () => {
    expect(parseAtlasQuery({})).toEqual(EMPTY_QUERY);
  });

  it('parses the exact URL shape the spec fixes', () => {
    // docs/00-SPEC.md §1.2: /atlas?strand=CNT&band=5-6&focus=CNT-12
    expect(parseAtlasQuery({ strand: 'CNT', band: '5-6', focus: 'CNT-12' })).toEqual({
      strands: ['CNT'],
      band: '5-6',
      points: null,
      hasProblems: false,
      focus: 'CNT-12',
      view: 'graph',
    });
  });

  it('accepts repeated and comma-separated strands, and sorts them', () => {
    expect(parseAtlasQuery({ strand: ['GEO', 'CNT'] }).strands).toEqual(['CNT', 'GEO']);
    expect(parseAtlasQuery({ strand: 'GEO,CNT' }).strands).toEqual(['CNT', 'GEO']);
  });

  it('de-duplicates', () => {
    expect(parseAtlasQuery({ strand: ['CNT', 'CNT'] }).strands).toEqual(['CNT']);
  });

  it('drops anything unrecognised rather than throwing — a URL is user input', () => {
    const query = parseAtlasQuery({
      strand: 'NOPE',
      band: '99-100',
      points: '7',
      focus: 'not-an-id',
      view: 'hologram',
    });
    expect(query).toEqual(EMPTY_QUERY);
  });

  it('reads the has-problems flag and the list view', () => {
    const query = parseAtlasQuery({ has: 'problems', view: 'list' });
    expect(query.hasProblems).toBe(true);
    expect(query.view).toBe('list');
  });

  it('reads a point filter', () => {
    expect(parseAtlasQuery({ points: '5' }).points).toBe(5);
  });
});

describe('toSearchParams and atlasHref', () => {
  it('omits every default, so the plain URL stays clean', () => {
    expect(atlasHref(EMPTY_QUERY)).toBe('/atlas');
  });

  it('round-trips a full query', () => {
    const query = {
      strands: ['CNT', 'GEO'] as const,
      band: '5-6' as const,
      points: 5 as const,
      hasProblems: true,
      focus: 'CNT-12',
      view: 'list' as const,
    };
    const parsed = parseAtlasQuery(Object.fromEntries(toSearchParams(query)));
    // Repeated keys collapse in Object.fromEntries, so compare the URL instead for strands.
    expect(toSearchParams(query).getAll('strand')).toEqual(['CNT', 'GEO']);
    expect(parsed.band).toBe('5-6');
    expect(parsed.points).toBe(5);
    expect(parsed.hasProblems).toBe(true);
    expect(parsed.focus).toBe('CNT-12');
    expect(parsed.view).toBe('list');
  });

  it('produces the same string for the same state, whatever order it was built in', () => {
    const a = atlasHref({ strands: ['GEO', 'CNT'], band: '3-4' });
    const b = atlasHref({ strands: ['CNT', 'GEO'], band: '3-4' });
    expect(a).toBe(b);
  });
});

describe('withStrandToggled', () => {
  it('adds a strand that is off', () => {
    expect(withStrandToggled(EMPTY_QUERY, 'CNT').strands).toEqual(['CNT']);
  });

  it('removes a strand that is on', () => {
    const on = { ...EMPTY_QUERY, strands: ['CNT', 'GEO'] as const };
    expect(withStrandToggled(on, 'CNT').strands).toEqual(['GEO']);
  });

  it('keeps the result sorted, so the URL is stable', () => {
    const query = withStrandToggled(withStrandToggled(EMPTY_QUERY, 'PAT'), 'CNT');
    expect(query.strands).toEqual(['CNT', 'PAT']);
  });
});

describe('isFiltered and describeQuery', () => {
  it('does not count a focus or a view as a filter', () => {
    expect(isFiltered({ ...EMPTY_QUERY, focus: 'CNT-12', view: 'list' })).toBe(false);
  });

  it('counts every real filter', () => {
    expect(isFiltered({ ...EMPTY_QUERY, strands: ['CNT'] })).toBe(true);
    expect(isFiltered({ ...EMPTY_QUERY, band: '3-4' })).toBe(true);
    expect(isFiltered({ ...EMPTY_QUERY, points: 3 })).toBe(true);
    expect(isFiltered({ ...EMPTY_QUERY, hasProblems: true })).toBe(true);
  });

  it('describes the active filters in a readable sentence', () => {
    const text = describeQuery({
      ...EMPTY_QUERY,
      strands: ['CNT'],
      band: '5-6',
      hasProblems: true,
    });
    expect(text).toBe('in CNT, taught at level 5–6, that have at least one problem');
  });

  it('says nothing when nothing is filtered', () => {
    expect(describeQuery(EMPTY_QUERY)).toBe('');
  });
});
