'use client';

import { useEffect, useRef } from 'react';
import type { MasteryState } from '@/lib/mastery';
import type { Points } from '@/lib/schemas';
import {
  EMPTY_FILTERS,
  facetCount,
  hasStatus,
  groupCounts,
  isFiltered,
  sectionCount,
  STATUS_OPTIONS,
  toggleValue,
  type BankFilters,
  type BankMarks,
  type BankRow,
  type BankStatus,
  type BankTaxonomy,
} from '@/lib/bank-filter';
import {
  Accordion,
  AccordionItem,
  Button,
  CheckboxRow,
  SegmentedControl,
  ToggleChip,
  cx,
} from '@/components/ui';

const DOTS: Record<Points, string> = { 3: '●○○', 4: '●●○', 5: '●●●' };

/**
 * The bank's left column (docs/06 §4): level (none for SAT and ACT), then one accordion per
 * strand (AMC area, SAT or ACT domain) with a checkbox per skill (or topic) showing solved / total, then difficulty, problem types (AMC),
 * status (with Saved and Missed, docs/08 item 10) and "Has a figure".
 *
 * Every control is a button or a checkbox, never a link, so a crawler finds no filter URLs
 * (docs/06 §3). The parent mirrors the state into the address bar with replaceState.
 */
export function BankFilterPanel({
  taxonomy,
  filters,
  onChange,
  rows,
  statuses,
  idPrefix,
  showHeading = true,
  pending = false,
  marks = {},
}: {
  taxonomy: BankTaxonomy;
  filters: BankFilters;
  /** Receives the next filters; the panel always resets to page 1. */
  onChange: (next: BankFilters) => void;
  rows: readonly BankRow[];
  statuses: ReadonlyMap<string, MasteryState>;
  /** Distinguishes the desktop column from the mobile sheet copy. */
  idPrefix: string;
  /** Off inside the mobile sheet, whose own title already says "Filters". */
  showHeading?: boolean;
  /**
   * True until the full index has arrived. `rows` is then only the server-rendered first page,
   * so any count worked out from it would be wrong (an AMC bank of 307 read as 50, with two
   * whole areas missing). While pending, every group is listed and no number is shown.
   */
  pending?: boolean;
  /** Saved and missed sets and search text, for the Saved / Missed counts and the query. */
  marks?: BankMarks;
}) {
  const set = (patch: Partial<BankFilters>) => onChange({ ...filters, ...patch, page: 1 });
  const counts = groupCounts(rows, filters, statuses);
  const pointCounts = facetCount(
    rows,
    filters,
    statuses,
    'points',
    (row, points: Points) => row.points === points,
    taxonomy.difficulty.options.map((option) => option.points),
    marks,
  );
  const statusCounts = facetCount(
    rows,
    filters,
    statuses,
    'status',
    (row, status: BankStatus) => hasStatus(row, status, statuses, marks),
    STATUS_OPTIONS.map((option) => option.value),
    marks,
  );
  const tagCounts = taxonomy.tags
    ? facetCount(
        rows,
        filters,
        statuses,
        'tags',
        (row, tag: string) => row.tags.includes(tag),
        taxonomy.tags.items.map((tag) => tag.id),
        marks,
      )
    : new Map<string, number>();
  const figureCount =
    facetCount(
      rows,
      filters,
      statuses,
      'figure',
      (row, _: true) => row.hasFigure,
      [true],
      marks,
    ).get(true) ?? 0;

  return (
    <div className="ui grid grid-cols-1 gap-5">
      <div className="flex min-h-9 items-center justify-between gap-2">
        {showHeading ? <h2 className="m-0 text-base font-semibold text-ink">Filters</h2> : <span />}
        {isFiltered(filters) ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </Button>
        ) : null}
      </div>

      {taxonomy.level ? (
        <SegmentedControl
          label={taxonomy.level.label}
          showLabel
          size="sm"
          wrap
          options={taxonomy.level.options}
          value={filters.level}
          onChange={(level) => set({ level })}
        />
      ) : null}

      <div role="group" aria-labelledby={`${idPrefix}-sections`}>
        <h3 id={`${idPrefix}-sections`} className="m-0 mb-1 text-2xs font-semibold text-ink-2">
          {taxonomy.sections.label}
        </h3>
        <Accordion className="-mx-2">
          {taxonomy.sections.items.map((section) => {
            const ids = section.groups.map((group) => group.id);
            const visible = pending
              ? section.groups
              : section.groups.filter(
                  (group) =>
                    (counts.get(group.id)?.total ?? 0) > 0 || filters.groups.includes(group.id),
                );
            if (visible.length === 0) return null;
            const picked = ids.filter((id) => filters.groups.includes(id));
            const all = picked.length === ids.length;
            const count = sectionCount(rows, ids, filters, statuses);
            return (
              <AccordionItem
                key={section.id}
                level={4}
                title={section.name}
                meta={
                  pending ? null : (
                    <>
                      <span aria-hidden="true">
                        {count.solved} / {count.total}
                      </span>
                      <span className="visually-hidden">
                        , {count.solved} of {count.total} solved
                      </span>
                    </>
                  )
                }
                defaultOpen={picked.length > 0}
                leading={
                  <SectionCheckbox
                    label={`All of ${section.name}`}
                    checked={all}
                    indeterminate={picked.length > 0 && !all}
                    onChange={(checked) =>
                      set({
                        groups: checked
                          ? [...new Set([...filters.groups, ...visible.map((g) => g.id)])]
                          : filters.groups.filter((id) => !ids.includes(id)),
                      })
                    }
                  />
                }
                panelClassName="pl-6"
              >
                {visible.map((group) => (
                  <CheckboxRow
                    key={group.id}
                    label={group.name}
                    checked={filters.groups.includes(group.id)}
                    onCheckedChange={() => set({ groups: toggleValue(filters.groups, group.id) })}
                    {...(pending ? {} : { count: counts.get(group.id) ?? { solved: 0, total: 0 } })}
                  />
                ))}
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 text-2xs font-semibold text-ink-2">
          {taxonomy.difficulty.label}
        </legend>
        <div className="-mx-2">
          {taxonomy.difficulty.options.map((option) => (
            <CheckboxRow
              key={option.points}
              label={option.label}
              {...(option.description ? { description: option.description } : {})}
              leading={
                <span className="mono text-2xs tracking-[0.08em] text-ink-2">
                  {DOTS[option.points]}
                </span>
              }
              checked={filters.points.includes(option.points)}
              onCheckedChange={() => set({ points: toggleValue(filters.points, option.points) })}
              {...(pending ? {} : { count: pointCounts.get(option.points) ?? 0 })}
            />
          ))}
        </div>
      </fieldset>

      {taxonomy.tags ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-2xs font-semibold text-ink-2">
            {taxonomy.tags.label}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {taxonomy.tags.items.map((tag) => (
              <ToggleChip
                key={tag.id}
                pressed={filters.tags.includes(tag.id)}
                onPressedChange={() => set({ tags: toggleValue(filters.tags, tag.id) })}
                {...(pending ? {} : { count: tagCounts.get(tag.id) ?? 0 })}
              >
                {tag.name}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 text-2xs font-semibold text-ink-2">Status</legend>
        <div className="-mx-2">
          {STATUS_OPTIONS.map((option) => (
            <CheckboxRow
              key={option.value}
              label={option.label}
              checked={filters.status.includes(option.value)}
              onCheckedChange={() => set({ status: toggleValue(filters.status, option.value) })}
              {...(pending ? {} : { count: statusCounts.get(option.value) ?? 0 })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 text-2xs font-semibold text-ink-2">Other</legend>
        <div className="-mx-2">
          <CheckboxRow
            label="Has a figure"
            checked={filters.figure}
            onCheckedChange={(figure) => set({ figure })}
            {...(pending ? {} : { count: figureCount })}
          />
        </div>
      </fieldset>
    </div>
  );
}

/** The strand-level box in an accordion header: ticks or clears every skill under it. */
function SectionCheckbox({
  label,
  checked,
  indeterminate,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <span className="flex h-11 w-8 shrink-0 items-center justify-center">
      <input
        ref={input}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cx('h-4 w-4 cursor-pointer accent-accent-600')}
      />
    </span>
  );
}
