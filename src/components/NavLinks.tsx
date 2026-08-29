'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, type NavItem } from '@/lib/site';

/**
 * The horizontal nav. Client-side only because it needs the current pathname to mark the
 * active section; `aria-current="page"` carries that to assistive technology, and the
 * underline carries it visually, so the state is never colour-only.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? '/';

  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-0.5 p-0">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'rounded-xs px-2.5 py-1.5 text-sm no-underline transition-colors',
                active
                  ? 'font-medium text-ink underline decoration-accent-600 decoration-2 underline-offset-8'
                  : 'text-ink-2 hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
