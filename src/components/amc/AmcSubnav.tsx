'use client';

import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { isNavItemActive, type NavItem } from '@/lib/site';

/**
 * The AMC beta's own section links, under the top bar on every /amc page. The overview, the
 * bank, the problem types, the formula sheet and the drill are five separate pages, and the
 * top bar has one "AMC" entry for all of them.
 *
 * The active link carries aria-current and a heavier weight as well as the teal tint, so the
 * state is never colour alone. On a narrow screen the row scrolls inside itself rather than
 * pushing the page wider.
 */
export const AMC_SECTIONS: NavItem[] = [
  { href: '/amc', label: 'Overview' },
  { href: '/amc/problems', label: 'Problems', also: ['/amc/problem', '/amc/practice'] },
  { href: '/amc/types', label: 'Problem types', also: ['/amc/type'] },
  { href: '/amc/formulas', label: 'Formula sheet' },
  { href: '/amc/formulas/drill', label: 'Flashcards' },
];

/** Exact for the overview and the sheet, whose child routes have their own links. */
export function isAmcSectionActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/amc' || item.href === '/amc/formulas') return pathname === item.href;
  return isNavItemActive(pathname, item);
}

export function AmcSubnav() {
  const pathname = usePathname() ?? '/amc';
  return (
    <nav aria-label="AMC beta sections" className="no-print border-b border-rule bg-surface">
      <ul className="m-0 mx-auto flex w-full max-w-app list-none gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {AMC_SECTIONS.map((item) => {
          const active = isAmcSectionActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'ui inline-flex min-h-9 items-center rounded-control px-3 text-sm whitespace-nowrap no-underline transition-colors motion-reduce:transition-none',
                  active
                    ? 'bg-accent-100 font-semibold text-accent-700'
                    : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
                ].join(' ')}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
