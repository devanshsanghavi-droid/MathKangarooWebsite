import Link from 'next/link';
import { atlasHref, type AtlasQuery } from '@/lib/atlas-params';

/**
 * Graph or list. Rendered first inside the Atlas region so that a reader arriving by keyboard
 * or with a screen reader meets the choice before the diagram, not after it.
 *
 * The two views are equals, not a main view and a fallback: they show the same skills, and the
 * list is often the faster way in even with a mouse.
 */
export function AtlasViewToggle({ query }: { query: AtlasQuery }) {
  const item = (active: boolean) =>
    [
      'rounded-xs px-3 py-1.5 text-sm no-underline transition-colors',
      active ? 'bg-accent-soft font-medium text-ink' : 'text-ink-2 hover:text-ink',
    ].join(' ');

  return (
    <div
      role="group"
      aria-label="Atlas view"
      className="inline-flex items-center gap-0.5 rounded-sm border border-rule p-0.5"
    >
      <Link
        href={atlasHref({ ...query, view: 'graph' })}
        aria-current={query.view === 'graph' ? 'true' : undefined}
        className={item(query.view === 'graph')}
      >
        Graph
      </Link>
      <Link
        href={atlasHref({ ...query, view: 'list' })}
        aria-current={query.view === 'list' ? 'true' : undefined}
        className={item(query.view === 'list')}
      >
        List
      </Link>
    </div>
  );
}
