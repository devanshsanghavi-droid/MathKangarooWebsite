import type { Metadata } from 'next';
import { getAllAmcProblems, getAmcTaxonomy } from '@/lib/amc-content';
import { buildAmcIndex, buildAmcLookups } from '@/lib/bank-data';
import {
  BANK_PAGE_SIZE,
  amcBankRows,
  amcBankTaxonomy,
  taxonomyGroupNames,
} from '@/lib/bank-filter';
import { QuestionBank } from '@/components/problems/QuestionBank';
import { MathProvider } from '@/components/math/MathProvider';
import { BetaBadge, PageContainer, PageHeader } from '@/components/ui';

/**
 * `/amc/problems` - the AMC beta's question bank (docs/06 §5).
 *
 * The same <QuestionBank> as /problems, given the AMC taxonomy: contest instead of level,
 * area and topic checkboxes instead of strands and skills, problem-type chips, and the Early /
 * Middle / Late tiers. Static: the first page is baked in at build time, and filtering runs in
 * the browser over /data/amc-index.json (docs/06 §3). <MathProvider> typesets the `$...$` in
 * the previews, on the server and after hydration alike.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC problem bank (beta)';
const DESCRIPTION =
  'Original AMC 8, AMC 10 and AMC 12 style problems, filterable by contest, area, topic, ' +
  'problem ' +
  'type and paper position. Every wrong answer explains the mistake that produces it.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc/problems' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/amc/problems', type: 'website' },
  };
}

export default function AmcProblemsPage() {
  const problems = getAllAmcProblems();
  const taxonomy = amcBankTaxonomy(buildAmcLookups(getAmcTaxonomy(), problems));
  const initialRows = amcBankRows(buildAmcIndex(problems), taxonomyGroupNames(taxonomy)).slice(
    0,
    BANK_PAGE_SIZE,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            AMC 8, AMC 10 and AMC 12 <BetaBadge />
          </>
        }
        title="AMC problem bank"
        description={`${problems.length} problems written from scratch in the style of the AMC 8, AMC 10 and AMC 12. Pick a contest, a few topics or a problem type, then start a set.`}
      />
      <MathProvider>
        <QuestionBank
          taxonomy={taxonomy}
          initialRows={initialRows}
          total={problems.length}
          listHeading="amc-bank-list-heading"
        />
      </MathProvider>
    </PageContainer>
  );
}
