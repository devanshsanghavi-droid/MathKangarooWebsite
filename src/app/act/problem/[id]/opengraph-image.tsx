import { TEST_OG_SIZE, testOgAlt, testOgImage } from '@/components/exams/test-og';
import { getAllTestProblems } from '@/lib/test-content';

export const size = TEST_OG_SIZE;
export const contentType = 'image/png';
export const alt = testOgAlt('ACT');

/** Only the ids that exist; an unknown id must not fall through to an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAllTestProblems('ACT').map((problem) => ({ id: problem.id }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return testOgImage('ACT', { problemId: id });
}
