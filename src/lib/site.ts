/**
 * One place for the facts about this site that appear in more than one component.
 *
 * The disclaimer is here rather than inline in <Footer> because CLAUDE.md requires it on every
 * page and a string that must never drift should have exactly one definition.
 */

export const SITE = {
  name: 'Kangaroo Atlas',
  tagline: 'Practice for every math exam in one place.',
  description:
    'Free practice for Math Kangaroo, AMC 8, AMC 10, AMC 12, SAT Math and ACT Math: original ' +
    'questions with an explanation written for the specific mistake you made, timed mock tests ' +
    'in the real format, and progress you can see. No account required, nothing paywalled.',
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
 * docs/08 item 12: every trademark owner named once, site-wide, in the footer under
 * DISCLAIMER (which stays as written). Area-specific notices below may also appear.
 */
export const TRADEMARK_NOTICE =
  'Math Kangaroo is a trademark of Math Kangaroo in USA, NFP. AMC 8, AMC 10, AMC 12 and AIME ' +
  'are trademarks of the Mathematical Association of America (MAA). SAT and PSAT are ' +
  'trademarks registered by the College Board. ACT is a registered trademark of ACT ' +
  'Education Corp. MATHCOUNTS is a registered trademark of the MATHCOUNTS Foundation. None of ' +
  'these organizations is affiliated with, or endorses, this site. All problems here are ' +
  'original.';

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
   * (`/exams`) also owns `/amc` and `/practice/*`, and the Question bank owns `/problem/*`.
   * Where two items' prefixes overlap, the longer match wins (activeNavHref).
   */
  also?: readonly string[];
}

/** Every exam area: the catalog, its exam pages and the three area homes. */
export const EXAM_AREAS: readonly string[] = ['/exams', '/amc', '/sat', '/act'];

/** Every question bank and single-question page, so "Bank" stays lit inside any of them. */
export const BANK_ROUTES: readonly string[] = [
  '/problem',
  '/amc/problems',
  '/amc/problem',
  '/sat/problems',
  '/sat/problem',
  '/act/problems',
  '/act/problem',
];

/** The tests hub and every mock and section test, so "Tests" stays lit inside a sitting. */
export const TEST_ROUTES: readonly string[] = [
  '/practice/mock',
  '/practice/section',
  '/amc/mock',
  '/amc/section',
  '/sat/mock',
  '/sat/section',
  '/act/mock',
  '/act/section',
];

/** The tests hub (docs/08 item 13): every exam's mock and section tests on one page. */
export const TESTS_HUB = '/exams/tests';

/**
 * docs/08 item 13, top bar: Practice (the exam catalog), Question bank, Skill Atlas, Tests,
 * Progress. The same destinations as the mobile tab bar, plus the Atlas, which has the room
 * here; the wordmark is the way home. The per-exam AMC, SAT and ACT links and Past papers are
 * one click away on the catalog. Five items, the same count and about the same width as the
 * five-item compact row docs/07 measured at 640px (a 1280px window at the 200% zoom CLAUDE.md
 * requires), and shorter than it with the full labels from `xl`.
 *
 * Highlighting is by the longest matching prefix (activeNavHref), so /amc/mock lights Tests
 * and /amc/problems lights the bank, while /amc itself lights Practice.
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    href: '/exams',
    label: 'Practice',
    short: 'Practice',
    also: [...EXAM_AREAS, '/practice', '/papers'],
  },
  { href: '/problems', label: 'Question bank', short: 'Bank', also: BANK_ROUTES },
  { href: '/atlas', label: 'Skill Atlas', short: 'Atlas', also: ['/skill'] },
  { href: TESTS_HUB, label: 'Tests', short: 'Tests', also: TEST_ROUTES },
  { href: '/progress', label: 'Progress', short: 'Progress' },
];

/**
 * docs/08 item 13, the mobile bottom bar: Home, Practice, Bank, Tests, Progress. Learn (the
 * Atlas, formula sheets) is reached from Practice and the exam pages, so the Atlas and skill
 * pages light Practice. Five tabs of at most "Progress" width fit 360px: 72px each.
 */
export const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Home', short: 'Home' },
  {
    href: '/exams',
    label: 'Practice',
    short: 'Practice',
    also: [...EXAM_AREAS, '/practice', '/papers', '/atlas', '/skill'],
  },
  { href: '/problems', label: 'Question bank', short: 'Bank', also: BANK_ROUTES },
  { href: TESTS_HUB, label: 'Tests', short: 'Tests', also: TEST_ROUTES },
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

/**
 * How closely `pathname` matches this item: the length of its longest matching prefix (href
 * or `also`), or -1 for no match. The home item ('/') matches only '/' itself.
 */
export function navMatchLength(pathname: string, item: NavItem): number {
  let best = -1;
  for (const prefix of [item.href, ...(item.also ?? [])]) {
    if (isActivePath(pathname, prefix)) best = Math.max(best, prefix.length);
  }
  return best;
}

/**
 * The one item of a nav that `pathname` belongs to: the item with the longest matching prefix,
 * the earlier item on a tie, or null when none matches. Prefixes overlap on purpose (/amc is
 * Practice, /amc/mock is Tests), and the most specific one wins.
 */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: NavItem | null = null;
  let bestLength = -1;
  for (const item of items) {
    const length = navMatchLength(pathname, item);
    if (length > bestLength) {
      best = item;
      bestLength = length;
    }
  }
  return best?.href ?? null;
}
