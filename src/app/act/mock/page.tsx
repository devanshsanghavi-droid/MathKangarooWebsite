import type { Metadata } from 'next';
import { TestMockPage, testMockMetadata } from '@/components/exam-runner/exam-pages';

/** `/act/mock` - a full timed ACT Math mock (docs/07 section 4). Static; runs in the browser. */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testMockMetadata('ACT');
}

export default function ActMockPage() {
  return <TestMockPage test="ACT" />;
}
