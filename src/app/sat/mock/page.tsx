import type { Metadata } from 'next';
import { TestMockPage, testMockMetadata } from '@/components/exam-runner/exam-pages';

/** `/sat/mock` - a full timed SAT Math mock (docs/07 section 4). Static; runs in the browser. */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testMockMetadata('SAT');
}

export default function SatMockPage() {
  return <TestMockPage test="SAT" />;
}
