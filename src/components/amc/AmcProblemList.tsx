'use client';

import { useMemo } from 'react';
import { useProgress } from '@/components/mastery/useProgress';
import { BankList } from '@/components/problems/BankList';
import { StatusLegend } from '@/components/problems/StatusGlyph';
import { ButtonLink, Card, ProgressBar } from '@/components/ui';
import { countBy, practiceIds, statusMap, type BankRow } from '@/lib/bank-filter';
import { PRACTICE_SET_MAX, practiceSetHref } from '@/lib/practice-item';

/**
 * A fixed list of AMC problems with the student's progress on it: the problems of one problem
 * type on /amc/type/[id]. The rows are built on the server (amcBankRows), so the list is in
 * the prerendered HTML; the status glyphs and the bar fill in from localStorage after mount.
 *
 * Reuses the bank's list and its set picker, so "Practise this type" hands over unsolved
 * problems first, exactly like Start practice in the bank. Render inside <MathProvider>.
 */
export function AmcProblemList({
  rows,
  heading,
  headingId,
  setName,
  progressLabel,
}: {
  rows: BankRow[];
  heading: string;
  headingId: string;
  /** Name of the practice set the button starts, e.g. the type's name. */
  setName: string;
  progressLabel: string;
}) {
  const file = useProgress();
  const statuses = useMemo(() => statusMap('amc', file, rows), [file, rows]);
  const tally = countBy(rows, statuses);
  const ids = practiceIds(rows, statuses, PRACTICE_SET_MAX);

  return (
    <Card padding="none">
      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={headingId} className="ui m-0 text-base font-semibold text-ink">
            {heading}
          </h2>
          {ids.length > 0 ? (
            <ButtonLink
              variant="primary"
              size="sm"
              href={practiceSetHref({ bank: 'amc', ids, name: setName })}
            >
              Practise these ({ids.length})
            </ButtonLink>
          ) : null}
        </div>
        <ProgressBar value={tally.solved} max={tally.total} label={progressLabel} size="sm" />
        <StatusLegend />
      </div>
      {rows.length > 0 ? (
        <div className="border-t border-rule">
          <BankList rows={rows} statuses={statuses} labelledBy={headingId} />
        </div>
      ) : (
        <p className="ui m-0 border-t border-rule px-4 py-6 text-sm text-ink-2">
          No problems of this type have been written yet. They are on the way.
        </p>
      )}
    </Card>
  );
}
