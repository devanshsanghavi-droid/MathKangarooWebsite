import type { ReactNode } from 'react';
import { AmcDisclaimer } from '@/components/AmcDisclaimer';
import { AmcSubnav } from '@/components/amc/AmcSubnav';

/**
 * Every page under /amc carries the MAA trademark notice (docs/06-V3-REDESIGN.md §2) in
 * addition to the Math Kangaroo disclaimer in the site footer, and the beta's own section
 * links (overview, problems, problem types, formula sheet, flashcards) under the top bar.
 */
export default function AmcLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AmcSubnav />
      {children}
      <AmcDisclaimer />
    </>
  );
}
