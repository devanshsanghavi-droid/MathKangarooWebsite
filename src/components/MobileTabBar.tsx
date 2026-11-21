'use client';

import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { activeNavHref, MOBILE_NAV } from '@/lib/site';
import { NavIcon } from './shell/NavIcon';
import { navAccessibleName } from './NavLinks';

/**
 * The bottom tab bar, shown only below the `sm` breakpoint: Home, Practice, Bank, Tests and
 * Progress (docs/08 item 13). Practice is the exam catalog, Tests the hub of every exam's mock
 * and section tests. Five equal tabs of 72px fit a 360px screen; a label that ever outgrew
 * its tab truncates rather than pushing the row wider. Its row is --tabbar-height tall, which
 * fixed bottom bars such as the ladder's action bar sit on top of.
 * `pb-[env(safe-area-inset-bottom)]` keeps it clear of the iOS home indicator. Exactly one tab
 * is active, the closest prefix match (activeNavHref), and it carries aria-current, an accent
 * bar above the icon and a heavier label, so the state is never colour alone.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? '/';
  const activeHref = activeNavHref(pathname, MOBILE_NAV);

  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="m-0 flex h-[var(--tabbar-height)] list-none p-0">
        {MOBILE_NAV.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-label={navAccessibleName(item)}
                className={[
                  'ui relative flex h-full flex-col items-center justify-center gap-1 px-1 text-2xs no-underline',
                  active ? 'font-semibold text-accent-700' : 'font-medium text-ink-2',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'absolute top-0 h-0.5 w-8 rounded-pill',
                    active ? 'bg-accent-600' : 'bg-transparent',
                  ].join(' ')}
                />
                <span aria-hidden="true" className="relative">
                  <NavIcon href={item.href} />
                  {item.beta ? (
                    <span className="absolute -top-1 -right-2 h-2 w-2 rounded-pill border border-surface bg-accent-600" />
                  ) : null}
                </span>
                <span aria-hidden="true" className="max-w-full truncate">
                  {item.short ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
