import Link from 'next/link';
import { PRIMARY_NAV, SITE } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';
import { NavLinks } from './NavLinks';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ground/95 backdrop-blur-sm">
      {/*
        `flex-wrap` plus a `min-w-0` nav. Without both, six nav items in the v2 UI face were
        wider than 640px of viewport — which is what a 1280px window looks like at the 200%
        zoom CLAUDE.md requires — and the theme toggle was pushed 19px off the right edge with
        the whole page scrolling sideways to reach it.
      */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 font-semibold tracking-tight text-ink no-underline hover:text-accent-700"
        >
          {SITE.name}
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 sm:block">
          <NavLinks items={PRIMARY_NAV} />
        </nav>

        <div className="ml-auto shrink-0 sm:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
