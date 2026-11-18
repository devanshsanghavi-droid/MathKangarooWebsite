import type { Metadata } from 'next';
import { TestSectionPage, testSectionMetadata } from '@/components/exam-runner/exam-pages';

/** `/act/section` - a 10-question timed ACT Math section test (docs/07 section 4). */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testSectionMetadata('ACT');
}

export default function ActSectionPage() {
  return <TestSectionPage test="ACT" />;
}
