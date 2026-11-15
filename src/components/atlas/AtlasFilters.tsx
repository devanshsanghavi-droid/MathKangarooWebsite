'use client';

import { BANDS, POINT_VALUES, STRANDS, type Band, type Points } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import { isFiltered, withStrandToggled, type AtlasQuery } from '@/lib/atlas-params';
import { Button, SegmentedControl, ToggleChip } from '@/components/ui';

/**
 * The Atlas filters: buttons, never links (docs/06-V3-REDESIGN.md §3).
 *
 * They used to be links, one URL per combination, and crawlers followed every one of them:
 * hundreds of thousands of variants, each a request to the worker. Now the page is a single
 * static file and the filtering happens here, in the browser. The selection is still mirrored
 * into the address bar (by the parent, with history.replaceState) so a view stays shareable.
 *
 * Strands are independent toggles (aria-pressed); level and point value are one-of-several
 * choices, so they are radio groups.
 */
export function AtlasFilters({
  query,
  resultCount,
  onChange,
}: {
  query: AtlasQuery;
  resultCount: number;
  onChange: (next: AtlasQuery) => void;
}) {
  const bandValue: Band | 'any' = query.band ?? 'any';
  const pointsValue = query.points === null ? 'any' : (String(query.points) as `${Points}`);

  return (
    <div className="ui grid gap-4 rounded-card border border-rule bg-surface p-4 shadow-xs">
      <div role="group" aria-labelledby="atlas-filter-strands">
        <p id="atlas-filter-strands" className="m-0 mb-2 text-2xs font-semibold text-ink-2">
          Strands
        </p>
        <ul className="m-0 flex flex-wrap list-none gap-1.5 p-0">
          {STRANDS.map((strand) => (
            <li key={strand}>
              <ToggleChip
                pressed={query.strands.includes(strand)}
                onPressedChange={() => onChange(withStrandToggled(query, strand))}
                title={STRAND_META[strand].name}
              >
                <span className="mono">{strand}</span>
                <span className="hidden sm:inline">{STRAND_META[strand].name}</span>
                <span className="visually-hidden sm:hidden"> {STRAND_META[strand].name}</span>
              </ToggleChip>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <SegmentedControl
          label="Level"
          showLabel
          size="sm"
          value={bandValue}
          onChange={(value) => onChange({ ...query, band: value === 'any' ? null : value })}
          options={[
            { value: 'any', label: 'Any' },
            ...BANDS.map((band) => ({ value: band, label: band, ariaLabel: `Level ${band}` })),
          ]}
        />
        <SegmentedControl
          label="Point value"
          showLabel
          size="sm"
          value={pointsValue}
          onChange={(value) =>
            onChange({ ...query, points: value === 'any' ? null : (Number(value) as Points) })
          }
          options={[
            { value: 'any', label: 'Any' },
            ...POINT_VALUES.map((points) => ({
              value: String(points) as `${Points}`,
              label: `${points} pt`,
              ariaLabel: `${points} points`,
            })),
          ]}
        />
        <div>
          <p aria-hidden="true" className="m-0 mb-1.5 text-2xs font-semibold text-ink-2">
            Coverage
          </p>
          <ToggleChip
            pressed={query.hasProblems}
            onPressedChange={(pressed) => onChange({ ...query, hasProblems: pressed })}
          >
            Has problems
          </ToggleChip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2">
        <p className="m-0" aria-live="polite">
          <strong className="font-semibold text-ink tabular-nums">{resultCount}</strong>{' '}
          {resultCount === 1 ? 'skill' : 'skills'} shown
        </p>
        {isFiltered(query) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...query,
                strands: [],
                band: null,
                points: null,
                hasProblems: false,
              })
            }
          >
            Clear all filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
