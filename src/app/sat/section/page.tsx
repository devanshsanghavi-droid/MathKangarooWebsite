import type { Metadata } from 'next';
import { TestSectionPage, testSectionMetadata } from '@/components/exam-runner/exam-pages';

/** `/sat/section` - a 10-question timed SAT Math section test (docs/07 section 4). */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testSectionMetadata('SAT');
}

export default function SatSectionPage() {
  return <TestSectionPage test="SAT" />;
}
