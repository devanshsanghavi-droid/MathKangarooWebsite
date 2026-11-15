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
  /**
   * The live origin. Every canonical URL, the sitemap, robots.txt and the JSON-LD are built
   * from it, so it must be a host that actually serves the site: when it pointed at an unused
   * vercel.app name, search engines were handed a sitemap on a dead host and the home page's
   * canonical pointed nowhere. The workers.dev address still serves the same worker, and its
   * pages name this one as canonical, so search engines fold the two together. NEXT_PUBLIC_SITE_URL
   * overrides it, and must be set as a BUILD variable, because it is inlined and prerendered.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kangarooatlas.com',
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

/**
 * The MAA notice docs/06-V3-REDESIGN.md §2 requires on every page under /amc, rendered by
 * <AmcDisclaimer> from src/app/amc/layout.tsx in addition to the footer's DISCLAIMER.
 */
export const AMC_DISCLAIMER =
  'AMC 10 and AMC 12 are trademarks of the Mathematical Association of America. ' +
  'Independent project. Not affiliated with or endorsed by the MAA.';

export interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile tab bar and for the top bar between `sm` and `lg`. */
  short?: string;
  /** Shows a "Beta" pill beside the label. */
  beta?: boolean;
  /**
   * Other route prefixes that count as inside this section for highlighting, e.g. Practice
   * (`/`) also owns `/practice/*`, and the Question bank owns `/problem/*`.
   */
  also?: readonly string[];
}

/**
 * docs/06-V3-REDESIGN.md §2: the v3 practice-app nav. The top bar and the mobile tab bar show
 * the same five destinations. The diagnostic and mock test are reached from the Practice home
 * (and the footer); About moved to the footer.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Practice', short: 'Practice', also: ['/practice'] },
  { href: '/problems', label: 'Question bank', short: 'Bank', also: ['/problem'] },
  { href: '/atlas', label: 'Skill Atlas', short: 'Atlas', also: ['/skill'] },
  { href: '/papers', label: 'Past papers', short: 'Papers' },
  { href: '/amc', label: 'AMC', short: 'AMC', beta: true },
];

/** The mobile bottom bar: the same destinations as the top bar (docs/06 §2). */
export const MOBILE_NAV: NavItem[] = PRIMARY_NAV;

export const FOOTER_LINKS: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/practice/diagnostic', label: 'Diagnostic' },
  { href: '/practice/mock', label: 'Mock test' },
  // Reachable, but not in the primary nav: an account only saves progress, and putting
  // "Sign in" beside the practice links would imply the practice needs one. It does not.
  { href: '/login', label: 'Sign in' },
  { href: '/print', label: 'Worksheets' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/license', label: 'License' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Where the skill rail (docs/05 §7.1) appears.
 *
 * The rail is the Atlas in miniature. v3 (docs/06-V3-REDESIGN.md) narrows it to the Atlas and
 * the skill pages: the question bank has its own 300px filter column, practice sessions are a
 * full-width test layout, and /papers and /amc are app pages at 1200px, where 91 skill links
 * beside the content would crowd out the thing the student came for. It stays off the
 * marketing, legal and utility pages, and off /print, whose whole output is a sheet of paper.
 */
export const RAIL_ROUTES: readonly string[] = ['/atlas', '/skill'];

export function hasRail(pathname: string): boolean {
  return RAIL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Is `pathname` inside the section rooted at `href`? Used for nav highlighting. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Is `pathname` inside this nav item's section, counting its `also` prefixes? */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (isActivePath(pathname, item.href)) return true;
  return (item.also ?? []).some((prefix) => isActivePath(pathname, prefix));
}
