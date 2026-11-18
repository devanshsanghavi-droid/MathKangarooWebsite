import type { Metadata } from 'next';
import {
  TestProblemPage,
  testProblemMetadata,
  testProblemParams,
} from '@/components/exams/test-pages';

interface Params {
  params: Promise<{ id: string }>;
}

/** Every SAT question is a static page; an unknown id is a real 404. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return testProblemParams('SAT');
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return testProblemMetadata('SAT', id);
}

export default async function SatProblemPage({ params }: Params) {
  const { id } = await params;
  return <TestProblemPage test="SAT" id={id} />;
}
