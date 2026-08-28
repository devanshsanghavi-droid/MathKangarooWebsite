import type { ReactNode } from 'react';

/**
 * One counter.
 *
 * Every tile states what it counts, in words, underneath the number — the same discipline
 * `/impact` will need in Phase 3, where "every tile links to its definition". A number with no
 * definition is a number nobody can check.
 */
export function StatTile({
  value,
  label,
  definition,
}: {
  value: ReactNode;
  label: string;
  definition: string;
}) {
  return (
    <div className="rounded-md border border-rule bg-surface p-4">
      <p className="m-0 text-2xl font-semibold text-ink tabular-nums">{value}</p>
      <p className="m-0 mt-1 text-sm font-medium text-ink-2">{label}</p>
      <p className="m-0 mt-1 text-xs text-ink-3">{definition}</p>
    </div>
  );
}
