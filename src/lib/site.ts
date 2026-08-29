/**
 * One place for the facts about this site that appear in more than one component.
 *
 * The disclaimer is here rather than inline in <Footer> because CLAUDE.md requires it on every
 * page and a string that must never drift should have exactly one definition.
 */

export const SITE = {
  name: 'Kangaroo Atlas',
  tagline: 'Math Kangaroo preparation organised by skill, not by year.',
  description:
    'A free, open platform for Math Kangaroo preparation. ~91 named skills in a prerequisite ' +
    'graph, an original problem bank, and an explanation written for the specific mistake you ' +
    'made. No account required, nothing paywalled.',
  /** Overridden by NEXT_PUBLIC_SITE_URL in a deployment; the fallback keeps builds hermetic. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kangaroo-atlas.vercel.app',
  repo: 'https://github.com/devanshsanghavi-droid/MathKangarooWebsite',
  contactEmail: 'devansh.sanghavi@gmail.com',
  locale: 'en',
} as const;

/**
 * CLAUDE.md, non-negotiable: this sentence appears in the footer of every page.
 * "Math Kangaroo" is used descriptively only.
 */
export const DISCLAIMER =
  'Independent project. Not affiliated with or endorsed by Math Kangaroo in USA, NFP.';

export interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile tab bar. */
  short?: string;
}

/**
 * docs/00-SPEC.md §0.2 lists Atlas · Problems · Practice · Papers · Impact. The diagnostic is
 * the first Practice surface to exist, and it works signed out. Impact is P3 and stays absent
 * rather than being a link to a 404. Add each route here in the milestone that builds it.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/atlas', label: 'Atlas' },
  { href: '/problems', label: 'Problems' },
  { href: '/practice/diagnostic', label: 'Diagnostic' },
  { href: '/papers', label: 'Papers' },
  { href: '/about', label: 'About' },
];

/** The mobile bottom bar. Home replaces the wordmark, which is not tappable on small screens. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Home', short: 'Home' },
  { href: '/atlas', label: 'Atlas', short: 'Atlas' },
  { href: '/problems', label: 'Problems', short: 'Problems' },
  { href: '/papers', label: 'Papers', short: 'Papers' },
];

export const FOOTER_LINKS: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/print', label: 'Worksheets' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/license', label: 'License' },
  { href: '/contact', label: 'Contact' },
];

/** Is `pathname` inside the section rooted at `href`? Used for nav highlighting. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
