'use client';

import type { NavItem } from '@/lib/site';
import { AreaSubnav, isAreaSectionActive } from '@/components/AreaSubnav';

/**
 * The AMC beta's own section links, under the top bar on every /amc page. The overview, the
 * bank, the mock, the section test, the problem types, the formula sheet and the drill are
 * separate pages, and the top bar has one "AMC" entry for all of them. The mock and the
 * section test (docs/07 section 4) are built alongside this area; these are only the links.
 */
export const AMC_SECTIONS: NavItem[] = [
  { href: '/amc', label: 'Overview' },
  { href: '/amc/problems', label: 'Problems', also: ['/amc/problem', '/amc/practice'] },
  { href: '/amc/mock', label: 'Mock test' },
  { href: '/amc/section', label: 'Section test' },
  { href: '/amc/types', label: 'Problem types', also: ['/amc/type'] },
  { href: '/amc/formulas', label: 'Formula sheet' },
  { href: '/amc/formulas/drill', label: 'Flashcards' },
];

/** Exact for the overview and the sheet, whose child routes have their own links. */
const EXACT = ['/amc', '/amc/formulas'] as const;

export function isAmcSectionActive(pathname: string, item: NavItem): boolean {
  return isAreaSectionActive(pathname, item, EXACT);
}

export function AmcSubnav() {
  return <AreaSubnav label="AMC beta sections" sections={AMC_SECTIONS} exact={EXACT} />;
}
