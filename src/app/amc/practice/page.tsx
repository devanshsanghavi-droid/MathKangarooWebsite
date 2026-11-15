import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui';
import { PracticeSetLoader } from '@/components/practice-session';

/**
 * `/amc/practice?bank=amc&ids=AM-0001,AM-0002` - an AMC practice set.
 *
 * The same static page and loader as /practice/set (docs/06 §3): the query is read in the
 * browser and each question is fetched from /data/p/<id>.json. It lives under /amc so the set
 * sits inside the beta's layout and carries the MAA notice. Every set is a different URL over
 * the same thin page, so none is indexed.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC practice set (beta)';
const DESCRIPTION =
  'An AMC 10 or AMC 12 practice set from the beta bank: check each answer, read the mistake ' +
  'behind a wrong one, and see how the set went by topic at the end.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc/practice' },
    robots: { index: false, follow: true },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/amc/practice', type: 'website' },
  };
}

export default function AmcPracticePage() {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <h1 className="visually-hidden">AMC practice set</h1>
        <PracticeSetLoader />
      </div>
    </PageContainer>
  );
}
