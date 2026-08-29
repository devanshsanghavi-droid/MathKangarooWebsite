'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, MOBILE_NAV } from '@/lib/site';

/**
 * The bottom tab bar, shown only below the `sm` breakpoint. It duplicates the header nav
 * rather than replacing it, so the same destinations are reachable however the page is used.
 * `pb-[env(safe-area-inset-bottom)]` keeps it clear of the iOS home indicator.
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-ground pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="m-0 flex list-none justify-around p-0">
        {MOBILE_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex flex-col items-center gap-0.5 px-2 py-2.5 text-2xs no-underline',
                  active ? 'font-semibold text-ink' : 'text-ink-3',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'block h-0.5 w-6 rounded-full',
                    active ? 'bg-accent-600' : 'bg-transparent',
                  ].join(' ')}
                />
                {item.short ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
