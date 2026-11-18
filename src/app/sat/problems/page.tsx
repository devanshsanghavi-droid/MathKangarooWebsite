import type { Metadata } from 'next';
import { TestBankPage, testBankMetadata } from '@/components/exams/test-pages';

/**
 * `/sat/problems` - the SAT question bank: the shared <QuestionBank> over
 * /data/sat-index.json. Static; filtering runs in the browser (docs/06 §3).
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testBankMetadata('SAT');
}

export default function SatProblemsPage() {
  return <TestBankPage test="SAT" />;
}
