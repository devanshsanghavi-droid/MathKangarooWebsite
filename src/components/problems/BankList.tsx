import Link from '@/components/AppLink';
import { DifficultyPill } from '@/components/DifficultyPill';
import { RichText } from '@/components/math/RichText';
import { Button, cx } from '@/components/ui';
import type { BankRow } from '@/lib/bank-filter';
import type { MasteryState } from '@/lib/mastery';
import { PROBLEM_STATUS_LABEL, StatusGlyph } from './StatusGlyph';

/**
 * The compact question list (docs/06 §4, OnePrep's list): status glyph, id, statement preview,
 * difficulty, level and skill, one dense row per problem. The statement is the one link in a
 * row, so a keyboard user tabs once per problem.
 */
export function BankList({
  rows,
  statuses,
  labelledBy,
}: {
  rows: readonly BankRow[];
  statuses: ReadonlyMap<string, MasteryState>;
  labelledBy?: string;
}) {
  return (
    <ol aria-labelledby={labelledBy} className="m-0 list-none p-0">
      {rows.map((row) => {
        const state = statuses.get(row.id) ?? 'unseen';
        return (
          <li
            key={row.id}
            className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-rule px-4 py-3 first:border-t-0 hover:bg-surface-2 sm:grid-cols-[auto_5.5rem_1fr_auto]"
          >
            <span className="pt-0.5">
              <StatusGlyph state={state} />
              <span className="visually-hidden">{PROBLEM_STATUS_LABEL[state]}. </span>
            </span>
            <span className="mono hidden pt-0.5 text-xs whitespace-nowrap text-ink-2 sm:block">
              {row.id}
            </span>
            <span className="min-w-0">
              <span className="mono block text-2xs text-ink-3 sm:hidden">{row.id}</span>
              <Link
                href={row.href}
                className="reading line-clamp-2 text-sm text-ink no-underline hover:underline"
              >
                <RichText text={row.statement} math={row.math} />
              </Link>
              <span className="ui mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-3">
                {row.primaryName ? <span className="text-ink-2">{row.primaryName}</span> : null}
                {row.groups.length > 1 ? <span>+{row.groups.length - 1}</span> : null}
                {row.hasFigure ? <span>figure</span> : null}
              </span>
            </span>
            <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end sm:self-start">
              {row.tierLabel ? (
                <span className="mono inline-flex items-center rounded-pill bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-2">
                  {row.tierLabel}
                </span>
              ) : (
                <DifficultyPill points={row.points} />
              )}
              <span className="mono text-2xs whitespace-nowrap text-ink-2">{row.levelLabel}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BankPagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
  className,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className={cx('ui flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="m-0 text-xs text-ink-2 tabular-nums">
        {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous<span className="visually-hidden"> page</span>
        </Button>
        <span className="text-xs text-ink-2 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
          Next<span className="visually-hidden"> page</span>
        </Button>
      </div>
    </nav>
  );
}
