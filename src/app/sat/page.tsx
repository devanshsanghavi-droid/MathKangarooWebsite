import type { Metadata } from 'next';
import { TestHomePage, testHomeMetadata } from '@/components/exams/test-pages';

/**
 * `/sat` - the SAT Math area home (docs/07 section 4): what it is, solved counts by
 * domain, and the way in to the mock, the section test and the bank. Static: the
 * problem list is baked in at build time and the progress is read in the browser.
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testHomeMetadata('SAT');
}

export default function SatPage() {
  return <TestHomePage test="SAT" />;
}
