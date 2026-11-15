import Link from '@/components/AppLink';
import { PRIMARY_NAV, SITE } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';
import { NavLinks } from './NavLinks';
import { BrandMark } from './shell/NavIcon';

/**
 * The v3 top bar (docs/06 §2): sticky, --surface, a hairline bottom border, the wordmark, the
 * five primary destinations and the theme toggle, inside the 1200px app column.
 *
 * Its height is fixed at --header-height so the skill rail can stick directly beneath it.
 * Below `sm` the nav moves to the bottom tab bar; between `sm` and `md` the wordmark shows
 * only its glyph, so five items plus the toggle fit at 640px, which is a 1280px window at the
 * 200% zoom CLAUDE.md requires.
 */
export function Header() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-surface">
      <div className="mx-auto flex h-[var(--header-height)] max-w-app items-center gap-3 px-4 sm:px-6 md:gap-6">
        <Link
          href="/"
          aria-label={`${SITE.name} home`}
          className="ui flex shrink-0 items-center gap-2 rounded-control font-semibold tracking-tight text-ink no-underline"
        >
          <BrandMark />
          <span aria-hidden="true" className="text-base sm:hidden md:inline">
            {SITE.name}
          </span>
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
