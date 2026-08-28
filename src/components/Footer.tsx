import Link from 'next/link';
import { DISCLAIMER, FOOTER_LINKS, SITE } from '@/lib/site';

/**
 * The disclaimer in here is a hard requirement from CLAUDE.md: it appears on every page.
 * It is marked up as its own paragraph rather than folded into the licence line so it reads
 * as a statement rather than as small print.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 pb-24 text-sm text-ink-2 sm:pb-8">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap list-none gap-x-5 gap-y-2 p-0">
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

        <p className="m-0 max-w-prose">
          Code is <Link href="/legal/license">MIT</Link>. Problems, skills, and explanations are{' '}
          <Link href="/legal/license">CC BY-NC-SA 4.0</Link>. Practice never requires an account and
          nothing here is paywalled.
        </p>

        <p className="m-0 max-w-prose font-medium text-ink">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
