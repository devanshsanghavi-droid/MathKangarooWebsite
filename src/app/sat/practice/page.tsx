import type { Metadata } from 'next';
import { TestPracticePage, testPracticeMetadata } from '@/components/exams/test-pages';

/** `/sat/practice?bank=sat&ids=...` - an SAT practice set (noindex, query read in the browser). */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testPracticeMetadata('SAT');
}

export default function SatPracticePage() {
  return <TestPracticePage test="SAT" />;
}
