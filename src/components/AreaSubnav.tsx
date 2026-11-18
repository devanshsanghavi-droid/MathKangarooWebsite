'use client';

import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { isNavItemActive, type NavItem } from '@/lib/site';

export interface AreaSubnavProps {
  /** The landmark's accessible name, e.g. "SAT sections". */
  label: string;
  /** The area's own pages, overview first. */
  sections: readonly NavItem[];
  /**
   * Hrefs matched exactly rather than as a prefix: the overview, and any page whose child
   * routes have their own link (the AMC formula sheet and its flashcards).
   */
  exact?: readonly string[];
}

/** Is this section link the current page? `exact` hrefs never claim their child routes. */
export function isAreaSectionActive(
  pathname: string,
  item: NavItem,
  exact: readonly string[],
): boolean {
  if (exact.includes(item.href)) return pathname === item.href;
  return isNavItemActive(pathname, item);
}

/**
 * An exam area's section links, under the top bar on every page of /amc, /sat and /act. The
 * top bar has one entry per area; this row reaches the overview, the bank, the mock and the
 * section test inside it.
 *
 * The active link carries aria-current and a heavier weight as well as the tint, so the state
 * is never colour alone. On a narrow screen the row scrolls inside itself rather than pushing
 * the page wider.
 */
export function AreaSubnav({ label, sections, exact }: AreaSubnavProps) {
  const pathname = usePathname() ?? sections[0]?.href ?? '/';
  const exactHrefs = exact ?? (sections[0] ? [sections[0].href] : []);
  return (
    <nav aria-label={label} className="no-print border-b border-rule bg-surface">
      <ul className="m-0 mx-auto flex w-full max-w-app list-none gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {sections.map((item) => {
          const active = isAreaSectionActive(pathname, item, exactHrefs);
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
