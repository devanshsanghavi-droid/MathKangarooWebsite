import Link from 'next/link';
import type { StrandSummary } from '@/lib/content';

/**
 * The seven strands with live counts, straight from the content index. Counts are computed at
 * build time from the files themselves, so this strip cannot drift from the bank the way a
 * hand-maintained number would.
 */
export function StrandStrip({ strands }: { strands: readonly StrandSummary[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {strands.map((strand) => (
        <li key={strand.strand}>
          <Link
            href={`/atlas/${strand.strand}`}
            className="flex h-full flex-col rounded-md border border-rule bg-surface p-4 no-underline transition-colors hover:border-rule-2"
          >
            <span className="flex items-baseline gap-2">
              <span className="mono text-2xs text-ink-3">{strand.strand}</span>
              <span className="font-medium text-ink">{strand.name}</span>
            </span>
            <span className="mt-2 flex-1 text-sm text-ink-2">{strand.blurb}</span>
            <span className="mono mt-3 text-2xs text-ink-3">
              {strand.skillCount} skills ·{' '}
              {strand.problemCount === 0
                ? 'no problems yet'
                : `${strand.problemCount} problem${strand.problemCount === 1 ? '' : 's'}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
