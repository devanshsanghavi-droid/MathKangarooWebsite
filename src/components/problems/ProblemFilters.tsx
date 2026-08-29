import Link from 'next/link';
import { BANDS, POINT_VALUES, STRANDS, type Skill } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import {
  isFiltered,
  problemsHref,
  SORTS,
  toggle,
  type ProblemQuery,
  type ProblemSort,
} from '@/lib/problem-query';

const SORT_LABEL: Record<ProblemSort, string> = {
  id: 'Id',
  difficulty: 'Hardest first',
  newest: 'Newest',
};

/**
 * The filter bar. Links again, for the same reasons as the Atlas: shareable URLs, a working
 * Back button, and no JavaScript required. Changing any filter resets to page 1, because the
 * page you were on may not exist in the new result set.
 */
export function ProblemFilters({
  query,
  resultCount,
  skill,
  calibrated,
}: {
  query: ProblemQuery;
  resultCount: number;
  skill?: Skill | undefined;
  /** How many problems have a measured p-value. Zero means the difficulty sort cannot work. */
  calibrated: number;
}) {
  const chip = (active: boolean) =>
    [
      'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs no-underline transition-colors',
      active
        ? 'border-accent-600 bg-accent-100 font-medium text-ink'
        : 'border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink',
    ].join(' ');

  const reset = { page: 1 };

  return (
    <div className="grid gap-4 rounded-md border border-rule bg-surface p-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Level</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {BANDS.map((band) => {
            const active = query.bands.includes(band);
            return (
              <li key={band}>
                <Link
                  href={problemsHref({ ...query, ...reset, bands: toggle(query.bands, band) })}
                  aria-current={active ? 'true' : undefined}
                  className={chip(active)}
                >
                  {band.replace('-', '–')}
                </Link>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Point value</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {POINT_VALUES.map((points) => {
            const active = query.points.includes(points);
            return (
              <li key={points}>
                <Link
                  href={problemsHref({ ...query, ...reset, points: toggle(query.points, points) })}
                  aria-current={active ? 'true' : undefined}
                  className={chip(active)}
                >
                  {points} pt
                </Link>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Strand</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {STRANDS.map((strand) => {
            const active = query.strands.includes(strand);
            return (
              <li key={strand}>
                <Link
                  href={problemsHref({
                    ...query,
                    ...reset,
                    strands: toggle(query.strands, strand),
                  })}
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

      {skill ? (
        <p className="m-0 flex flex-wrap items-baseline gap-2 text-sm">
          <span className="text-2xs text-ink-3">Skill</span>
          <span className="mono text-xs text-ink-2">{skill.id}</span>
          <span className="text-ink">{skill.name}</span>
          <Link
            href={problemsHref({ ...query, ...reset, skill: null })}
            className="text-xs no-underline hover:underline"
          >
            remove
          </Link>
        </p>
      ) : null}

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs text-ink-3">Sort</legend>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {SORTS.map((sort) => (
            <li key={sort}>
              <Link
                href={problemsHref({ ...query, ...reset, sort })}
                aria-current={query.sort === sort ? 'true' : undefined}
                className={chip(query.sort === sort)}
              >
                {SORT_LABEL[sort]}
              </Link>
            </li>
          ))}
        </ul>
        {query.sort === 'difficulty' && calibrated === 0 ? (
          /*
            docs/01-DATA-MODEL.md §3.3: difficulty is measured, never asserted. Until a problem
            has 30 first attempts it has no p-value, so this sort has nothing to sort on. Saying
            so is better than silently falling back to id order and letting a tutor believe the
            top of the list is the hardest.
          */
          <p className="mt-2 mb-0 text-xs text-ink-3">
            No problem has been attempted 30 times yet, so nothing has a measured difficulty.
            Difficulty on this site comes from data, never from a hand-set field — until it exists,
            this order is the same as by id.
          </p>
        ) : null}
      </fieldset>

      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-3">
        <span>
          <strong className="font-medium text-ink">{resultCount}</strong>{' '}
          {resultCount === 1 ? 'problem' : 'problems'}
        </span>
        {isFiltered(query) ? (
          <Link href={problemsHref({ sort: query.sort })} className="no-underline hover:underline">
            Clear all filters
          </Link>
        ) : null}
      </p>
    </div>
  );
}
