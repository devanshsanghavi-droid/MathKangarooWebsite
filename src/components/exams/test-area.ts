import { ACT_DISCLAIMER, SAT_DISCLAIMER, type NavItem } from '@/lib/site';
import { TEST_LABEL, TEST_SLUG, type StdTest } from '@/lib/test-meta';

/**
 * Everything that differs between the SAT and ACT areas (docs/07 sections 1, 3 and 4), in one
 * place, so /sat and /act are the same pages given a different test. Browser-safe: no Zod, no
 * filesystem.
 */
export interface TestArea {
  test: StdTest;
  slug: 'sat' | 'act';
  /** "SAT Math". */
  name: string;
  /** "SAT". */
  short: string;
  /** The trademark notice under every page of the area, verbatim from docs/07 section 1. */
  disclaimer: string;
  /** The same in a few words, for the share card's footer. */
  ogNotice: string;
  /** What one top-level section of the taxonomy is called: SAT domains, ACT categories. */
  sectionNoun: string;
  /** One paragraph for the area home. */
  intro: string;
  /** The mock's real-format summary (docs/07 section 3). */
  mockFormat: string;
}

export const TEST_AREAS: Readonly<Record<StdTest, TestArea>> = {
  SAT: {
    test: 'SAT',
    slug: TEST_SLUG.SAT,
    name: TEST_LABEL.SAT,
    short: 'SAT',
    disclaimer: SAT_DISCLAIMER,
    ogNotice: 'Independent. Not affiliated with the College Board.',
    sectionNoun: 'domain',
    intro:
      'Original multiple-choice questions in the style of the SAT Math section, sorted into the ' +
      'four SAT domains and their skills. Every wrong answer explains the mistake that produces ' +
      'it. A calculator is allowed throughout, as on the real test.',
    mockFormat: '44 questions in two modules of 22, 35 minutes each',
  },
  ACT: {
    test: 'ACT',
    slug: TEST_SLUG.ACT,
    name: TEST_LABEL.ACT,
    short: 'ACT',
    disclaimer: ACT_DISCLAIMER,
    ogNotice: 'Independent. Not affiliated with ACT Education Corp.',
    sectionNoun: 'category',
    intro:
      'Original multiple-choice questions in the style of the ACT Math test, sorted into the ' +
      'five ACT reporting categories and their skills. Every wrong answer explains the mistake ' +
      'that produces it. A calculator is allowed throughout, as on the real test.',
    mockFormat: '45 questions in 50 minutes',
  },
};

/** The area's own section links, under the top bar (see AreaSubnav). */
export function testAreaSections(test: StdTest): NavItem[] {
  const slug = TEST_SLUG[test];
  return [
    { href: `/${slug}`, label: 'Overview' },
    {
      href: `/${slug}/problems`,
      label: 'Problems',
      also: [`/${slug}/problem`, `/${slug}/practice`],
    },
    { href: `/${slug}/mock`, label: 'Mock test' },
    { href: `/${slug}/section`, label: 'Section test' },
  ];
}
