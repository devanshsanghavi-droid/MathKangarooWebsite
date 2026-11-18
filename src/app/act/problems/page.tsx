import type { Metadata } from 'next';
import { TestBankPage, testBankMetadata } from '@/components/exams/test-pages';

/**
 * `/act/problems` - the ACT question bank: the shared <QuestionBank> over
 * /data/act-index.json. Static; filtering runs in the browser (docs/06 §3).
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return testBankMetadata('ACT');
}

export default function ActProblemsPage() {
  return <TestBankPage test="ACT" />;
}
