import type { Metadata } from 'next';
import { getAllAmcProblems, getAmcFormulas, getAmcTaxonomy } from '@/lib/amc-content';
import Link from '@/components/AppLink';
import { AmcHome, type AmcHomeArea } from '@/components/amc/AmcHome';
import { BetaBadge, PageContainer, PageHeader } from '@/components/ui';

/**
 * `/amc` - the AMC 8 / AMC 10 / AMC 12 beta landing (docs/06 §5, docs/07 section 2): a paper
 * switch, progress by area and
 * tier, "Start a mixed set", and the way in to the formula sheet and the problem types.
 *
 * Static: the problem list (id, slot, contest, area, topic) is baked in at build time and the
 * progress is read in the browser. No searchParams, no request-time reads.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC 8, AMC 10 and AMC 12 practice (beta)';
const DESCRIPTION =
  'A free beta for AMC 8, AMC 10 and AMC 12 preparation: original problems organised by area, ' +
  'topic and problem type, mock tests, a must-know formula sheet and flashcards. No account.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/amc', type: 'website' },
  };
}

export default function AmcPage() {
  const taxonomy = getAmcTaxonomy();
  const formulas = getAmcFormulas();
  const problems = getAllAmcProblems().map((problem) => ({
    id: problem.id,
    slot: problem.slot,
    contest: problem.contest,
    area: problem.area,
    topic: problem.topic,
  }));
  const areas: AmcHomeArea[] = taxonomy.areas.map((area) => ({
    id: area.id,
    name: area.name,
    description: area.description,
    topics: taxonomy.topics
      .filter((topic) => topic.area === area.id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((topic) => ({ id: topic.id, name: topic.name, amc12Only: topic.amc12Only })),
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            AMC 8, AMC 10 and AMC 12 <BetaBadge />
          </>
        }
        title="AMC practice"
        description="Original problems in the style of the AMC 8, AMC 10 and AMC 12, organised by area, topic and the recurring problem types, with feedback written for the mistake you made. This area is new: expect gaps, and tell us what is wrong."
        actions={
          <p className="ui m-0 text-sm text-ink-2">
            Format and tips:{' '}
            <Link href="/exams/amc8" aria-label="AMC 8 format and tips">
              AMC 8
            </Link>
            ,{' '}
            <Link href="/exams/amc10" aria-label="AMC 10 format and tips">
              AMC 10
            </Link>
            ,{' '}
            <Link href="/exams/amc12" aria-label="AMC 12 format and tips">
              AMC 12
            </Link>
          </p>
        }
      />
      <AmcHome
        problems={problems}
        areas={areas}
        formulaCount={formulas.length}
        mustKnowCount={formulas.filter((formula) => formula.priority === 'must-know').length}
        typeCount={taxonomy.types.length}
      />
    </PageContainer>
  );
}
