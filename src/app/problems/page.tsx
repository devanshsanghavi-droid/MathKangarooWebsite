import type { Metadata } from 'next';
import { getAllProblems, getAllSkills, getContentStats } from '@/lib/content';
import { buildKaIndex, buildKaLookups } from '@/lib/bank-data';
import { BANK_PAGE_SIZE, kaBankRows, kaBankTaxonomy, taxonomyGroupNames } from '@/lib/bank-filter';
import { QuestionBank } from '@/components/problems/QuestionBank';
import { PageContainer, PageHeader } from '@/components/ui';

/**
 * `/problems` - the question bank (docs/06 §4, OnePrep's layout).
 *
 * Static (docs/06 §3). The page is rendered once at build time with the unfiltered first page
 * of problems in it; filtering, status and pagination then run in the browser over
 * `public/data/ka-index.json`. The old version read searchParams on the server, so every
 * filter link was a fresh worker render, and crawlers following those links exhausted the
 * Workers free plan's daily allowance.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Question bank',
  description:
    'Every problem in the bank, filterable by level, skill, difficulty and your own progress. ' +
    'All original, all with an explanation written for each wrong answer.',
  alternates: { canonical: '/problems' },
};

export default function ProblemsPage() {
  const problems = getAllProblems();
  const stats = getContentStats();
  const taxonomy = kaBankTaxonomy(buildKaLookups(getAllSkills(), problems));
  const initialRows = kaBankRows(buildKaIndex(problems), taxonomyGroupNames(taxonomy)).slice(
    0,
    BANK_PAGE_SIZE,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Question bank"
        description={`${stats.problems} problems, every one written from scratch, every wrong answer carrying the mistake that produces it. ${stats.misconceptions} explanations in all.`}
      />
      <QuestionBank taxonomy={taxonomy} initialRows={initialRows} total={stats.problems} />
    </PageContainer>
  );
}
