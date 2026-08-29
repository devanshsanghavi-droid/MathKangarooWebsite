import Link from 'next/link';
import { BANDS, POINT_VALUES, STRANDS } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import { printHref, MAX_PROBLEMS, type WorksheetQuery } from '@/lib/worksheet';

/**
 * The controls above the sheet. Marked `no-print`, so the printed page starts at the worksheet
 * itself with no browser chrome, no navigation and no filter bar.
 *
 * "Reshuffle" is a link to the same URL with the next seed, which is what makes a second sheet
 * on the same skills reproducible rather than random: the tutor can print sheet 7 again next
 * term and get exactly the same questions.
 */
export function WorksheetControls({
  query,
  available,
  selected,
}: {
  query: WorksheetQuery;
  available: number;
  selected: number;
}) {
  const chip = (active: boolean) =>
    [
      'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs no-underline transition-colors',
      active
        ? 'border-accent-600 bg-accent-100 font-medium text-ink'
        : 'border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink',
    ].join(' ');

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="no-print grid gap-4 rounded-md border border-rule bg-surface p-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Level</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {BANDS.map((band) => (
            <li key={band}>
              <Link
                href={printHref({ ...query, bands: toggle(query.bands, band) })}
                aria-current={query.bands.includes(band) ? 'true' : undefined}
                className={chip(query.bands.includes(band))}
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
          {POINT_VALUES.map((points) => (
            <li key={points}>
              <Link
                href={printHref({ ...query, points: toggle(query.points, points) })}
                aria-current={query.points.includes(points) ? 'true' : undefined}
                className={chip(query.points.includes(points))}
              >
                {points} pt
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Strand</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {STRANDS.map((strand) => (
            <li key={strand}>
              <Link
                href={printHref({ ...query, strands: toggle(query.strands, strand) })}
                aria-current={query.strands.includes(strand) ? 'true' : undefined}
                className={chip(query.strands.includes(strand))}
                title={STRAND_META[strand].name}
              >
                <span className="mono">{strand}</span>
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs text-ink-3">How many</legend>
          <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
            {[5, 10, 15, 20, MAX_PROBLEMS].map((count) => (
              <li key={count}>
                <Link
                  href={printHref({ ...query, count })}
                  aria-current={query.count === count ? 'true' : undefined}
                  className={chip(query.count === count)}
                >
                  {count}
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs text-ink-3">Figures</legend>
          <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
            <li>
              <Link
                href={printHref({ ...query, figures: true })}
                aria-current={query.figures ? 'true' : undefined}
                className={chip(query.figures)}
              >
                Include
              </Link>
            </li>
            <li>
              <Link
                href={printHref({ ...query, figures: false })}
                aria-current={!query.figures ? 'true' : undefined}
                className={chip(!query.figures)}
              >
                Text only
              </Link>
            </li>
          </ul>
        </fieldset>
      </div>

      <p className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-3">
        <span>
          <strong className="font-medium text-ink">{selected}</strong> on the sheet, {available}{' '}
          match these filters
        </span>
        <Link
          href={printHref({ ...query, seed: query.seed + 1 })}
          className="no-underline hover:underline"
        >
          Reshuffle
        </Link>
        <Link href={printHref({})} className="no-underline hover:underline">
          Start over
        </Link>
        <span className="mono">seed {query.seed}</span>
      </p>
      <p className="m-0 text-xs text-ink-3">
        This exact URL always produces this exact sheet — bookmark it and the answer key will still
        match next term. Print with your browser; the controls and the site navigation are left off
        the page.
      </p>
    </div>
  );
}
