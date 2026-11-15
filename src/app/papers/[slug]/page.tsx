import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { notFound } from 'next/navigation';
import { getAllPapers, getAllSkills, getPaper } from '@/lib/content';
import {
  expectedQuestionCount,
  isComplete,
  mostTestedSkills,
  paperSlug,
  paperTitle,
  parsePaperSlug,
  pointDistribution,
} from '@/lib/papers';
import { POINT_VALUES } from '@/lib/schemas';
import { PaperQuestionTable } from '@/components/papers/PaperQuestionTable';
import { MostTestedSkills } from '@/components/papers/MostTestedSkills';
import { DifficultyPill } from '@/components/DifficultyPill';
import { BandPill } from '@/components/BandPill';
import {
  buttonClasses,
  Card,
  CardHeader,
  PageContainer,
  PageHeader,
  ProgressBar,
  StatTile,
} from '@/components/ui';

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * The complete set of valid ids is known at build time - content lives in git and nothing is
 * created at runtime - so anything outside that set is a 404, not a page to try rendering.
 *
 * This is not a micro-optimisation. With the default `dynamicParams: true`, Next rendered the
 * page for an unknown id, hit `notFound()`, and then cached and served that not-found body with
 * an HTTP **200**. A wrong URL looked fine to a crawler and to any client that checks the
 * status rather than the words on the page.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getAllPapers().map((paper) => ({ slug: paperSlug(paper) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const parsed = parsePaperSlug((await params).slug);
  const paper = parsed ? getPaper(parsed.year, parsed.band) : undefined;
  if (!paper) return { title: 'Paper not indexed', robots: { index: false } };

  return {
    title: `${paperTitle(paper)} - skill index`,
    description: `Our skill analysis of the ${paperTitle(paper)} Math Kangaroo paper: every question mapped to the skills it tests. No question text, figures or answers.`,
    alternates: { canonical: `/papers/${paperSlug(paper)}` },
  };
}

export default async function PaperPage({ params }: Params) {
  const parsed = parsePaperSlug((await params).slug);
  const paper = parsed ? getPaper(parsed.year, parsed.band) : undefined;
  if (!paper) notFound();

  const skillNames = new Map(getAllSkills().map((skill) => [skill.id, skill.name]));
  const distribution = pointDistribution(paper);
  const frequencies = mostTestedSkills([paper]);

  const expected = expectedQuestionCount(paper.band);

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="ui mb-4 text-xs text-ink-2">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/papers" className="no-underline hover:underline">
              Papers
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="mono">{paperSlug(paper)}</li>
        </ol>
      </nav>

      <PageHeader
        eyebrow={<BandPill band={paper.band} />}
        title={paperTitle(paper)}
        actions={
          /*
            The official PDF is always remote. We never host a copy: not in the repo, not on the
            CDN, not "temporarily".
          */
          <a
            href={paper.officialPdfUrl}
            rel="noreferrer"
            className={buttonClasses({ variant: 'primary' })}
          >
            Read the official paper on mathkangaroo.org
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Indexed"
          value={`${paper.questions.length} / ${expected}`}
          detail={`${paper.questions.length} of ${expected} questions indexed`}
          footer={
            <ProgressBar
              hideLabel
              value={paper.questions.length}
              max={expected}
              unit="indexed"
              label="Questions indexed"
            />
          }
        />
        {POINT_VALUES.map((points) => (
          <StatTile
            key={points}
            label={`${points}-point questions`}
            value={distribution.get(points) ?? 0}
            detail={<DifficultyPill points={points} />}
          />
        ))}
      </div>

      <Card as="aside" aria-label="About this index" padding="md" className="mt-6 bg-surface-2">
        <p className="prose-measure m-0 text-sm text-ink-2">
          Below is <strong>our analysis</strong> of this paper, not the paper. It holds question
          numbers, point values, the skills we tagged, and our own short notes. It contains no
          question text, no figures and no answers. Read those in the official PDF above.
        </p>
        {isComplete(paper) ? null : (
          <p className="mt-2 mb-0 text-sm text-ink-2">
            This index is partial: {paper.questions.length} of the {expected} questions have been
            classified so far.
          </p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card as="section" aria-labelledby="questions-heading" padding="lg">
          <CardHeader titleId="questions-heading" title="Question by question" />
          <div className="mt-3">
            <PaperQuestionTable paper={paper} skillNames={skillNames} />
          </div>
        </Card>

        <Card
          as="section"
          aria-labelledby="most-tested-heading"
          padding="lg"
          className="self-start"
        >
          <CardHeader titleId="most-tested-heading" title="Skills most tested in this paper" />
          <div className="mt-4">
            <MostTestedSkills
              frequencies={frequencies}
              skillNames={skillNames}
              questionCount={paper.questions.length}
            />
          </div>
        </Card>
      </div>

      <p className="mt-8 mb-0 text-sm">
        <Link href="/papers">All indexed papers</Link>
      </p>
    </PageContainer>
  );
}
