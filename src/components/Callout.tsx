import type { ReactNode } from 'react';

/** A short aside that belongs with the surrounding prose rather than interrupting it. */
export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="rounded-sm border border-rule bg-surface-2 px-4 py-3">
      {title ? <p className="m-0 text-sm font-semibold text-ink">{title}</p> : null}
      <div className={`prose-measure text-sm text-ink-2 ${title ? 'mt-1' : ''}`}>{children}</div>
    </aside>
  );
}
