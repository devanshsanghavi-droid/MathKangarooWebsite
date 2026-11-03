'use client';

import Link from 'next/link';
import { useProgress } from '@/components/mastery/useProgress';
import { bucketOf, statusOfProblem } from '@/lib/progress-summary';
import { paginate, problemsHref, type ProblemQuery } from '@/lib/problem-query';
import { Pagination } from './Pagination';
import { ProblemTable, type ProblemRow } from './ProblemTable';

const EMPTY_COPY: Record<Exclude<ProblemQuery['status'], 'all'>, string> = {
  todo: 'You have tried every problem these filters match. Widen them, or switch to Attempted to go back over the ones you missed.',
  attempted:
    'Nothing here is attempted and still unsolved. Either you have not started these yet, or you solved every one you tried.',
  solved: 'No problem these filters match is solved in this browser yet. Pick one from To do.',
};

/**
 * The status step of the filter, done where the progress is: in the browser.
 *
 * The server applies every other filter and hands over the whole matching list (a few hundred
 * short rows at most). This narrows it by status, then paginates with the same `page` URL
 * parameter, so a status view is still a link with a working Back button. Before hydration it
 * renders as a brand-new visitor's view, which is also what a student with no progress sees.
 */
export function StatusFilteredTable({
  rows,
  query,
  showSolveRate,
}: {
  rows: ProblemRow[];
  query: ProblemQuery;
  showSolveRate: boolean;
}) {
  const file = useProgress();
  const wanted = query.status;
  const kept =
    wanted === 'all'
      ? rows
      : rows.filter((row) => bucketOf(statusOfProblem(file, row.id, row.skillIds)) === wanted);
  const page = paginate(kept, query.page);

  return (
    <>
      <p className="mt-4 mb-0 text-xs text-ink-3" aria-live="polite">
        <strong className="font-medium text-ink">{kept.length}</strong> of {rows.length} matching
        problems
      </p>
      {wanted !== 'all' && kept.length === 0 ? (
        <p className="mt-3 rounded-md border border-rule bg-surface p-4 text-sm text-ink-2">
          {EMPTY_COPY[wanted]}{' '}
          <Link href={problemsHref({ ...query, status: 'all', page: 1 })}>Show all</Link>
        </p>
      ) : (
        <ProblemTable rows={[...page.items]} showSolveRate={showSolveRate} />
      )}
      <Pagination page={page} href={(number) => problemsHref({ ...query, page: number })} />
    </>
  );
}
