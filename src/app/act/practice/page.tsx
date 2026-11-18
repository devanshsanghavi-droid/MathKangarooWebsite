import type { Metadata } from 'next';
import { TestPracticePage, testPracticeMetadata } from '@/components/exams/test-pages';

/** `/act/practice?bank=act&ids=...` - an ACT practice set (noindex, query read in the browser). */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testPracticeMetadata('ACT');
}

export default function ActPracticePage() {
  return <TestPracticePage test="ACT" />;
}
