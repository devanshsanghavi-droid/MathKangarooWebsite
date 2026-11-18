import type { Metadata } from 'next';
import { TestHomePage, testHomeMetadata } from '@/components/exams/test-pages';

/**
 * `/act` - the ACT Math area home (docs/07 section 4): what it is, solved counts by
 * category, and the way in to the mock, the section test and the bank. Static: the
 * problem list is baked in at build time and the progress is read in the browser.
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testHomeMetadata('ACT');
}

export default function ActPage() {
  return <TestHomePage test="ACT" />;
}
