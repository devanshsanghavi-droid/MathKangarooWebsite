'use client';

import { useId } from 'react';
import { BANDS, POINT_VALUES, STRANDS } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import { DEFAULT_WORKSHEET, MAX_PROBLEMS, type WorksheetQuery } from '@/lib/worksheet';
import { Button, Card, ToggleChip } from '@/components/ui';

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * The controls above the sheet. Marked `no-print`, so the printed page starts at the worksheet
 * itself with no browser chrome, no navigation and no filter bar.
 *
 * Buttons, not links (docs/06 §3): the page is static and every change is applied in the
 * browser and mirrored into the URL. "Reshuffle" moves to the next seed, which is what makes a
 * second sheet on the same skills reproducible rather than random: the tutor can open sheet 7's
 * URL again next term and get exactly the same questions.
 */
export function WorksheetControls({
  query,
  onChange,
  available,
  selected,
  onPrint,
  loading,
}: {
  query: WorksheetQuery;
  onChange: (next: WorksheetQuery) => void;
  available: number;
  selected: number;
  onPrint: () => void;
  loading: boolean;
}) {
  const titleId = useId();
  const set = (patch: Partial<WorksheetQuery>) => onChange({ ...query, ...patch });

  return (
    <Card className="no-print ui grid gap-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">Level</legend>
        <div className="flex flex-wrap gap-1.5">
          {BANDS.map((band) => (
            <ToggleChip
              key={band}
              pressed={query.bands.includes(band)}
              onPressedChange={() => set({ bands: toggle(query.bands, band) })}
              aria-label={`Level ${band}`}
            >
              {band}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">Point value</legend>
        <div className="flex flex-wrap gap-1.5">
          {POINT_VALUES.map((points) => (
            <ToggleChip
              key={points}
              pressed={query.points.includes(points)}
              onPressedChange={() => set({ points: toggle(query.points, points) })}
            >
              {points} pt
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">Strand</legend>
        <div className="flex flex-wrap gap-1.5">
          {STRANDS.map((strand) => (
            <ToggleChip
              key={strand}
              pressed={query.strands.includes(strand)}
              onPressedChange={() => set({ strands: toggle(query.strands, strand) })}
            >
              {STRAND_META[strand].name}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">How many</legend>
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 15, 20, MAX_PROBLEMS].map((count) => (
              <ToggleChip
                key={count}
                pressed={query.count === count}
                onPressedChange={() => set({ count })}
              >
                {count}
              </ToggleChip>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">Figures</legend>
          <div className="flex flex-wrap gap-1.5">
            <ToggleChip pressed={query.figures} onPressedChange={() => set({ figures: true })}>
              Include
            </ToggleChip>
            <ToggleChip pressed={!query.figures} onPressedChange={() => set({ figures: false })}>
              Text only
            </ToggleChip>
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor={titleId} className="mb-2 block text-2xs font-semibold text-ink-2">
          Sheet title
        </label>
        <input
          id={titleId}
          type="text"
          maxLength={60}
          value={query.title}
          placeholder="Math Kangaroo practice"
          onChange={(event) => set({ title: event.target.value.slice(0, 60) })}
          className="min-h-11 w-full max-w-md rounded-control border border-rule-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onPrint} disabled={selected === 0 || loading}>
          Print the sheet and key
        </Button>
        <Button onClick={() => set({ seed: query.seed + 1 })}>Reshuffle</Button>
        <Button variant="ghost" onClick={() => onChange(DEFAULT_WORKSHEET)}>
          Start over
        </Button>
      </div>

      <p
        className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-3"
        aria-live="polite"
      >
        <span>
          <strong className="font-medium text-ink">{selected}</strong> on the sheet, {available}{' '}
          match these filters
        </span>
        <span className="mono">seed {query.seed}</span>
      </p>
      <p className="m-0 text-xs text-ink-3">
        The address bar always holds this exact sheet - bookmark it and the answer key will still
        match next term. The controls and the site navigation are left off the printed page.
      </p>
    </Card>
  );
}
