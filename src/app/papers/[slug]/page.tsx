import type { Metadata } from 'next';
import Link from 'next/link';
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
import { PointPill } from '@/components/PointPill';
import { BandPill } from '@/components/BandPill';
import { Callout } from '@/components/Callout';

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * The complete set of valid ids is known at build time — content lives in git and nothing is
 * created at runtime — so anything outside that set is a 404, not a page to try rendering.
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
    title: `${paperTitle(paper)} — skill index`,
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/papers" className="no-underline hover:underline">
              Papers
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="mono text-ink-2">{paperSlug(paper)}</li>
        </ol>
      </nav>

      <header>
        <h1 className="m-0 text-2xl">{paperTitle(paper)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BandPill band={paper.band} />
          {POINT_VALUES.map((points) => (
            <span key={points} className="inline-flex items-center gap-1.5">
              <PointPill points={points} />
              <span className="mono text-2xs text-ink-3">{distribution.get(points) ?? 0}</span>
            </span>
          ))}
          <span className="mono text-2xs text-ink-3">
            {paper.questions.length} of {expectedQuestionCount(paper.band)} questions indexed
          </span>
        </div>
        <p className="mt-4 mb-0">
          {/*
            The official PDF is always remote. We never host a copy: not in the repo, not on the
            CDN, not "temporarily".
          */}
          <a href={paper.officialPdfUrl} rel="noreferrer">
            Read the official paper on mathkangaroo.org
          </a>
        </p>
      </header>

      <div className="mt-6">
        <Callout>
          <p className="m-0">
            Below is <strong>our analysis</strong> of this paper, not the paper. It holds question
            numbers, point values, the skills we tagged, and our own short notes. It contains no
            question text, no figures and no answers — read those in the official PDF above.
          </p>
        </Callout>
      </div>

      {isComplete(paper) ? null : (
        <p className="mt-4 mb-0 text-sm text-ink-3">
          This index is partial: {paper.questions.length} of the {expectedQuestionCount(paper.band)}{' '}
          questions have been classified so far.
        </p>
      )}

      <section aria-labelledby="questions-heading" className="mt-10">
        <h2 id="questions-heading" className="m-0 text-lg">
          Question by question
        </h2>
        <div className="mt-3">
          <PaperQuestionTable paper={paper} skillNames={skillNames} />
        </div>
      </section>

      <section aria-labelledby="most-tested-heading" className="mt-10">
        <h2 id="most-tested-heading" className="m-0 text-lg">
          Skills most tested in this paper
        </h2>
        <div className="mt-3">
          <MostTestedSkills
            frequencies={frequencies}
            skillNames={skillNames}
            questionCount={paper.questions.length}
          />
        </div>
      </section>

      <p className="mt-10 border-t border-rule pt-6 text-sm">
        <Link href="/papers">All indexed papers</Link>
      </p>
    </div>
  );
}
