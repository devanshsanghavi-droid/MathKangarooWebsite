'use client';

import { useState, type ReactNode } from 'react';
import { Button, CheckboxRow, SegmentedControl } from '@/components/ui';
import type { AmcFormulaContest, FormulaPriority } from '@/lib/amc-schemas';
import { filterFormulas, type FormulaContestFilter } from '@/lib/formula-sheet';

export interface FormulaSheetItem {
  id: string;
  area: string;
  priority: FormulaPriority;
  contests: AmcFormulaContest[];
  /** The card, rendered on the server (KaTeX included), so this component ships no KaTeX. */
  card: ReactNode;
}

const PRIORITY_HEADING: Record<FormulaPriority, string> = {
  'must-know': 'Must-know',
  'good-to-know': 'Good to know',
};

/**
 * The formula sheet's filters and layout (docs/06 §5): by area, must-know first, with a
 * contest filter, a must-know-only switch and a Print button. The cards arrive pre-rendered
 * from the server; this only decides which to show. Controls are buttons and a checkbox, so
 * nothing here is a crawlable filter URL, and none of them print.
 */
export function FormulaSheet({
  items,
  areas,
}: {
  items: FormulaSheetItem[];
  areas: Array<{ id: string; name: string }>;
}) {
  const [contest, setContest] = useState<FormulaContestFilter>('all');
  const [mustOnly, setMustOnly] = useState(false);
  const shown = filterFormulas(items, { contest, mustOnly });

  return (
    <div className="grid gap-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4 rounded-card border border-rule bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            label="Contest"
            showLabel
            size="sm"
            options={[
              { value: 'all', label: 'All', ariaLabel: 'All AMC contests' },
              { value: 'AMC8', label: 'AMC 8' },
              { value: 'AMC10', label: 'AMC 10' },
              { value: 'AMC12', label: 'AMC 12' },
            ]}
            value={contest}
            onChange={setContest}
          />
          <CheckboxRow label="Must-know only" checked={mustOnly} onCheckedChange={setMustOnly} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="ui m-0 text-xs text-ink-2 tabular-nums" aria-live="polite">
            {shown.length} {shown.length === 1 ? 'formula' : 'formulas'}
          </p>
          <Button size="sm" onClick={() => window.print()}>
            Print this sheet
          </Button>
        </div>
      </div>

      <nav aria-label="Areas on this sheet" className="no-print">
        <ul className="ui m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
          {areas.map((area) => (
            <li key={area.id}>
              <a
                href={`#area-${area.id}`}
                className="inline-flex min-h-9 items-center rounded-pill border border-rule bg-surface px-3 text-ink-2 no-underline hover:border-rule-strong hover:text-ink"
              >
                {area.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {areas.map((area) => {
        const inArea = shown.filter((item) => item.area === area.id);
        return (
          <section
            key={area.id}
            id={`area-${area.id}`}
            aria-labelledby={`area-${area.id}-heading`}
            className="scroll-mt-24"
          >
            <h2 id={`area-${area.id}-heading`} className="m-0 text-xl">
              {area.name}
            </h2>
            {inArea.length === 0 ? (
              <p className="ui m-0 mt-2 text-sm text-ink-2">
                No formulas in this area match the filters.
              </p>
            ) : (
              (['must-know', 'good-to-know'] as const).map((priority) => {
                const group = inArea.filter((item) => item.priority === priority);
                if (group.length === 0) return null;
                return (
                  <div key={priority} className="mt-3">
                    <h3 className="ui m-0 mb-2 text-xs font-semibold text-ink-2">
                      {PRIORITY_HEADING[priority]} ({group.length})
                    </h3>
                    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 print:block">
                      {group.map((item) => (
                        <li key={item.id} className="min-w-0 break-inside-avoid print:mb-3">
                          {item.card}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
