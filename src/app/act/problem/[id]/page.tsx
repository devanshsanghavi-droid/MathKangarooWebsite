import type { Metadata } from 'next';
import {
  TestProblemPage,
  testProblemMetadata,
  testProblemParams,
} from '@/components/exams/test-pages';

interface Params {
  params: Promise<{ id: string }>;
}

/** Every ACT question is a static page; an unknown id is a real 404. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return testProblemParams('ACT');
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return testProblemMetadata('ACT', id);
}

export default async function ActProblemPage({ params }: Params) {
  const { id } = await params;
  return <TestProblemPage test="ACT" id={id} />;
}
