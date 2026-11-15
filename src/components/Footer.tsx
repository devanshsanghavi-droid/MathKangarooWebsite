import Link from '@/components/AppLink';
import { DISCLAIMER, FOOTER_LINKS, SITE } from '@/lib/site';
import { BrandMark } from './shell/NavIcon';

/**
 * The disclaimer in here is a hard requirement from CLAUDE.md: it appears on every page.
 * It is marked up as its own paragraph rather than folded into the licence line so it reads
 * as a statement rather than as small print. Pages under /amc add the MAA notice above this
 * footer through <AmcDisclaimer>, rendered by src/app/amc/layout.tsx (docs/06 §2).
 *
 * The bottom padding below `sm` clears the fixed mobile tab bar.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-app gap-6 px-4 pt-8 pb-[calc(var(--tabbar-height)+2rem)] text-sm text-ink-2 sm:px-6 sm:pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="ui flex items-start gap-2.5">
          <BrandMark className="shrink-0" />
          <div>
            <p className="m-0 font-semibold text-ink">{SITE.name}</p>
            <p className="m-0 mt-0.5 text-xs text-ink-2">{SITE.tagline}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <nav aria-label="Footer">
            <ul className="ui m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="no-underline hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={SITE.repo} className="no-underline hover:underline">
                  GitHub
                </a>
              </li>
            </ul>
          </nav>

          <p className="m-0 max-w-prose text-xs">
            Code is <Link href="/legal/license">MIT</Link>. Problems, skills, and explanations are{' '}
            <Link href="/legal/license">CC BY-NC-SA 4.0</Link>. Practice never requires an account
            and nothing here is paywalled.
          </p>

          <p className="m-0 max-w-prose text-xs font-medium text-ink">{DISCLAIMER}</p>
        </div>
      </div>
    </footer>
  );
}
