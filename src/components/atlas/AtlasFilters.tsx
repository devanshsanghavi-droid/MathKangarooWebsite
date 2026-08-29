import Link from 'next/link';
import { BANDS, POINT_VALUES, STRANDS } from '@/lib/schemas';
import { STRAND_META } from '@/lib/content';
import { atlasHref, isFiltered, withStrandToggled, type AtlasQuery } from '@/lib/atlas-params';

/**
 * Every filter is a link, not a form control.
 *
 * That means the whole filter bar works with JavaScript switched off, every state is a real
 * URL you can share or bookmark, and the browser's back button undoes a filter — none of which
 * a client-side control gives you for free. The cost is that toggling two strands takes two
 * navigations, which on a statically rendered page is imperceptible.
 *
 * Active filters are marked with `aria-current`, not `aria-pressed`: `aria-pressed` belongs to
 * buttons, and axe flags it as a critical violation on a link. These really are links — they
 * navigate — so `aria-current` is both allowed and more accurate.
 */
export function AtlasFilters({ query, resultCount }: { query: AtlasQuery; resultCount: number }) {
  const chip = (active: boolean) =>
    [
      'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs no-underline transition-colors',
      active
        ? 'border-accent-600 bg-accent-100 font-medium text-ink'
        : 'border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink',
    ].join(' ');

  return (
    <div className="grid gap-4 rounded-md border border-rule bg-surface p-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Strands</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {STRANDS.map((strand) => {
            const active = query.strands.includes(strand);
            return (
              <li key={strand}>
                <Link
                  href={atlasHref(withStrandToggled(query, strand))}
                  aria-current={active ? 'true' : undefined}
                  className={chip(active)}
                  title={STRAND_META[strand].name}
                >
                  <span className="mono">{strand}</span>
                  <span className="hidden sm:inline">{STRAND_META[strand].name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs text-ink-3">Level</legend>
          <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
            <li>
              <Link
                href={atlasHref({ ...query, band: null })}
                className={chip(query.band === null)}
              >
                Any
              </Link>
            </li>
            {BANDS.map((band) => (
              <li key={band}>
                <Link
                  href={atlasHref({ ...query, band })}
                  aria-current={query.band === band ? 'true' : undefined}
                  className={chip(query.band === band)}
                >
                  {band.replace('-', '–')}
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs text-ink-3">Point value</legend>
          <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
            <li>
              <Link
                href={atlasHref({ ...query, points: null })}
                className={chip(query.points === null)}
              >
                Any
              </Link>
            </li>
            {POINT_VALUES.map((points) => (
              <li key={points}>
                <Link
                  href={atlasHref({ ...query, points })}
                  aria-current={query.points === points ? 'true' : undefined}
                  className={chip(query.points === points)}
                >
                  {points} pt
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs text-ink-3">Coverage</legend>
          <Link
            href={atlasHref({ ...query, hasProblems: !query.hasProblems })}
            aria-current={query.hasProblems ? 'true' : undefined}
            className={chip(query.hasProblems)}
          >
            Has problems
          </Link>
        </fieldset>
      </div>

      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-3">
        <span>
          <strong className="font-medium text-ink">{resultCount}</strong>{' '}
          {resultCount === 1 ? 'skill' : 'skills'} shown
        </span>
        {isFiltered(query) ? (
          <Link href={atlasHref({ view: query.view })} className="no-underline hover:underline">
            Clear all filters
          </Link>
        ) : null}
      </p>
    </div>
  );
}
