import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui';
import { PracticeSetLoader } from '@/components/practice-session';

/**
 * `/practice/set?ids=KA-0001,KA-0002` (or `?bank=amc&ids=AM-0001,...`) - a practice set.
 *
 * docs/06 §3: static. The query is read in the browser and each question is fetched from
 * `public/data/p/<id>.json`, so a set costs the worker one cached page and nothing per click.
 * Every set is a different URL with the same thin page behind it, so none of them is indexed.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Practice set',
  description:
    'A practice set from the Kangaroo Atlas question bank: check each answer, read the mistake ' +
    'behind a wrong one, and see how the set went by skill at the end.',
  alternates: { canonical: '/practice/set' },
  robots: { index: false, follow: true },
};

export default function PracticeSetPage() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <h1 className="visually-hidden">Practice set</h1>
        <PracticeSetLoader />
      </div>
    </PageContainer>
  );
}
