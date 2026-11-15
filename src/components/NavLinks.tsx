'use client';

import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { isNavItemActive, type NavItem } from '@/lib/site';
import { BetaBadge } from '@/components/ui/Badge';

/** "AMC (Beta)": what a screen reader hears for a nav item, whichever label is on screen. */
export function navAccessibleName(item: NavItem): string {
  return item.beta ? `${item.label} (Beta)` : item.label;
}

/**
 * The top-bar nav (docs/06 §2). Client-side only because it needs the current pathname to
 * mark the active section. The active item carries `aria-current="page"`, a heavier weight
 * and the teal tint, so the state is never colour alone. Between `sm` and `lg` the short
 * labels show; the accessible name is always the full label.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? '/';

  return (
    <ul className="m-0 flex list-none items-center gap-0.5 p-0 lg:gap-1">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={navAccessibleName(item)}
              className={[
                'ui inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 text-sm whitespace-nowrap no-underline transition-colors motion-reduce:transition-none lg:px-3',
                active
                  ? 'bg-accent-100 font-semibold text-accent-700'
                  : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
              ].join(' ')}
            >
              <span aria-hidden="true" className="lg:hidden">
                {item.short ?? item.label}
              </span>
              <span aria-hidden="true" className="hidden lg:inline">
                {item.label}
              </span>
              {item.beta ? <BetaBadge /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
