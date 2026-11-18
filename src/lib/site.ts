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
  'AMC 8, AMC 10 and AMC 12 are trademarks of the Mathematical Association of America. ' +
  'Independent project. Not affiliated with or endorsed by the MAA.';

/**
 * docs/07-EXAMS-PROGRESS-MOCKS.md section 1: the notices every page under /sat and /act
 * carries, rendered by <TrademarkNotice> from those areas' layouts, verbatim.
 */
export const SAT_DISCLAIMER =
  'SAT is a trademark registered by the College Board, which is not affiliated with, and does ' +
  'not endorse, this site.';

export const ACT_DISCLAIMER =
  'ACT is a registered trademark of ACT Education Corp., which is not affiliated with, and ' +
  'does not endorse, this site.';

export interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile tab bar and for the top bar between `sm` and `xl`. */
  short?: string;
  /** Shows a "Beta" pill beside the label. */
  beta?: boolean;
  /**
   * Other route prefixes that count as inside this section for highlighting, e.g. Practice
   * (`/`) also owns `/practice/*`, and the Question bank owns `/problem/*`.
   */
  also?: readonly string[];
  /**
   * Top bar only. `wide` items show from `lg` up, `compact` items only below it: Past papers,
   * AMC, SAT and ACT each get their own link on a wide screen, and fold into one "Exams" link
   * (the /exams hub, which links all four) where eight links would not fit. Hidden with
   * display:none, so a screen reader never meets the copy that is not on screen.
   */
  only?: 'wide' | 'compact';
}

/** Every exam area, for the Exams entry's highlighting. */
export const EXAM_AREAS: readonly string[] = ['/exams', '/amc', '/sat', '/act'];

/**
 * docs/06-V3-REDESIGN.md §2, extended by docs/07 section 4: the top bar. On a wide screen it
 * reads Practice, Question bank, Skill Atlas, Past papers, AMC, SAT, ACT, Progress. Below `lg`
 * Past papers and the three exam links fold into one "Exams" link to the /exams hub, so the
 * row is no wider than the old five-item one and still fits at 640px (a 1280px window at the
 * 200% zoom CLAUDE.md requires). Measured in Figtree at 15px: about 570px of 592 at 640px,
 * 950px of 976 at 1024px, and 1110px of 1152 with the full labels from `xl`.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Practice', short: 'Practice', also: ['/practice'] },
  { href: '/problems', label: 'Question bank', short: 'Bank', also: ['/problem'] },
  { href: '/atlas', label: 'Skill Atlas', short: 'Atlas', also: ['/skill'] },
  { href: '/papers', label: 'Past papers', short: 'Papers', only: 'wide' },
  {
    href: '/exams',
    label: 'Exams',
    short: 'Exams',
    also: [...EXAM_AREAS, '/papers'],
    only: 'compact',
  },
  { href: '/amc', label: 'AMC', short: 'AMC', beta: true, only: 'wide' },
  { href: '/sat', label: 'SAT', short: 'SAT', only: 'wide' },
  { href: '/act', label: 'ACT', short: 'ACT', only: 'wide' },
  { href: '/progress', label: 'Progress', short: 'Progress' },
];

/**
 * The mobile bottom bar keeps five tabs (docs/07 section 4): the exams sit behind one "Exams"
 * tab, the /exams hub, which also links the Kangaroo past papers.
 */
export const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Practice', short: 'Practice', also: ['/practice'] },
  { href: '/problems', label: 'Question bank', short: 'Bank', also: ['/problem'] },
  { href: '/atlas', label: 'Skill Atlas', short: 'Atlas', also: ['/skill'] },
  { href: '/exams', label: 'Exams', short: 'Exams', also: [...EXAM_AREAS, '/papers'] },
  { href: '/progress', label: 'Progress', short: 'Progress' },
];

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
