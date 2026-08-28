import Link from 'next/link';
import { PRIMARY_NAV, SITE } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';
import { NavLinks } from './NavLinks';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 font-semibold tracking-tight text-ink no-underline hover:text-accent"
        >
          {SITE.name}
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 sm:block">
          <NavLinks items={PRIMARY_NAV} />
        </nav>

        <div className="ml-auto shrink-0 sm:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
