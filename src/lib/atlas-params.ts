import { BANDS, POINT_VALUES, STRANDS, type Band, type Points, type Strand } from './schemas';

/**
 * The Atlas's URL state.
 *
 * `docs/00-SPEC.md` §1.2 fixes the shape: `/atlas?strand=CNT&band=5-6&focus=CNT-12`. Filters
 * live in the URL rather than in component state so a view is shareable, survives a reload and
 * works with the back button — and so the page can stay server-rendered.
 *
 * Parsing is total: anything unrecognised is dropped rather than throwing, because a URL is
 * user input and a mistyped band should show the unfiltered Atlas, not an error page.
 */

export type AtlasView = 'graph' | 'list';

export interface AtlasQuery {
  /** Empty means every strand. */
  strands: readonly Strand[];
  band: Band | null;
  points: Points | null;
  hasProblems: boolean;
  focus: string | null;
  view: AtlasView;
}

export const EMPTY_QUERY: AtlasQuery = {
  strands: [],
  band: null,
  points: null,
  hasProblems: false,
  focus: null,
  view: 'graph',
};

/** Next gives searchParams as string | string[] | undefined; accept every shape. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function values(raw: RawSearchParams, key: string): string[] {
  const value = raw[key];
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  // `?strand=CNT,GEO` and `?strand=CNT&strand=GEO` both work; neither is more obvious.
  return list
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseAtlasQuery(raw: RawSearchParams): AtlasQuery {
  const strands = values(raw, 'strand').filter((value): value is Strand =>
    (STRANDS as readonly string[]).includes(value),
  );
  const band = values(raw, 'band').find((value): value is Band =>
    (BANDS as readonly string[]).includes(value),
  );
  const points = values(raw, 'points')
    .map(Number)
    .find((value): value is Points => (POINT_VALUES as readonly number[]).includes(value));
  const focus = values(raw, 'focus').find((value) => /^[A-Z]{3}-\d{2}$/.test(value));
  const view = values(raw, 'view').includes('list') ? 'list' : 'graph';

  return {
    strands: [...new Set(strands)].sort(),
    band: band ?? null,
    points: points ?? null,
    hasProblems: values(raw, 'has').includes('problems'),
    focus: focus ?? null,
    view,
  };
}

/**
 * Serialise back to a query string. Defaults are omitted, so the plain `/atlas` URL stays
 * clean and two equivalent states always produce the same string.
 */
export function toSearchParams(query: Partial<AtlasQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const strand of [...(query.strands ?? [])].sort()) params.append('strand', strand);
  if (query.band) params.set('band', query.band);
  if (query.points) params.set('points', String(query.points));
  if (query.hasProblems) params.set('has', 'problems');
  if (query.focus) params.set('focus', query.focus);
  if (query.view === 'list') params.set('view', 'list');
  return params;
}

export function atlasHref(query: Partial<AtlasQuery>): string {
  const params = toSearchParams(query).toString();
  return params ? `/atlas?${params}` : '/atlas';
}

/** The same query with one strand toggled on or off — what a strand checkbox link does. */
export function withStrandToggled(query: AtlasQuery, strand: Strand): AtlasQuery {
  const strands = query.strands.includes(strand)
    ? query.strands.filter((value) => value !== strand)
    : [...query.strands, strand];
  return { ...query, strands: [...strands].sort() };
}

export function isFiltered(query: AtlasQuery): boolean {
  return (
    query.strands.length > 0 || query.band !== null || query.points !== null || query.hasProblems
  );
}

/** A sentence describing the active filters, for the result count line. */
export function describeQuery(query: AtlasQuery): string {
  const parts: string[] = [];
  if (query.strands.length > 0) parts.push(`in ${query.strands.join(', ')}`);
  if (query.band) parts.push(`taught at level ${query.band.replace('-', '–')}`);
  if (query.points) parts.push(`with a ${query.points}-point problem`);
  if (query.hasProblems) parts.push('that have at least one problem');
  return parts.join(', ');
}
