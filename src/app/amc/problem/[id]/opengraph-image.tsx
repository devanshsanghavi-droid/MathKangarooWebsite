import { getAllAmcProblems, getAmcProblem, getAmcTaxonomy } from '@/lib/amc-content';
import { amcContestLabel, amcTierLabel } from '@/lib/practice-item';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

/** Only the ids that exist; an unknown id must not fall through to an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAllAmcProblems().map((problem) => ({ id: problem.id }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getAmcProblem(id);
  if (!problem) return amcOgImage({ kicker: 'AMC problem', title: 'AMC beta' });
  const topic = getAmcTaxonomy().topics.find((entry) => entry.id === problem.topic);
  return amcOgImage({
    kicker: `${problem.id}, ${amcContestLabel(problem.contest)}`,
    title: topic?.name ?? problem.topic,
    detail: amcTierLabel(problem.slot),
  });
}
