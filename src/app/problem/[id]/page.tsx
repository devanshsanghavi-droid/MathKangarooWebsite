import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAdjacentInSkill,
  getAllProblems,
  getProblem,
  getSkill,
  getSkillsForProblem,
} from '@/lib/content';
import { ProblemCard } from '@/components/ProblemCard';
import { DifficultyPill, TIER_MEANING } from '@/components/DifficultyPill';
import { bandLabel } from '@/components/BandPill';
import { reportProblemUrl } from '@/lib/report';

interface Params {
  params: Promise<{ id: string }>;
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

/** Every problem in content/ becomes a static page. */
export function generateStaticParams(): Array<{ id: string }> {
  return getAllProblems().map((problem) => ({ id: problem.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) return { title: 'Problem not found', robots: { index: false } };

  const skill = getSkill(problem.skills.primary);
  const title = skill ? `${problem.id} — ${skill.name}` : problem.id;

  return {
    title,
    description: problem.whyOnTest,
    alternates: { canonical: `/problem/${problem.id}` },
    openGraph: {
      title,
      description: problem.whyOnTest,
      type: 'article',
      url: `/problem/${problem.id}`,
    },
  };
}

export default async function ProblemPage({ params }: Params) {
  const { id } = await params;
  const problem = getProblem(id);
  if (!problem) notFound();

  const { primary } = getSkillsForProblem(problem);
  const { previous, next, position, total } = getAdjacentInSkill(problem.id);

  return (
    <div className="content-column px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/problems" className="no-underline hover:underline">
              Problems
            </Link>
          </li>
          {primary ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/skill/${primary.id}`} className="no-underline hover:underline">
                  {primary.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="mono text-ink-2">{problem.id}</li>
        </ol>
      </nav>

      <ProblemCard
        problem={problem}
        headingLevel={1}
        {...(primary ? { headingSuffix: primary.name } : {})}
      />

      {/*
        The point tier is explained rather than just displayed. A student who knows that a
        5-point question needs an idea, not more arithmetic, triages the paper better - which
        is the whole of CFT-08.
      */}
      <p className="mt-6 flex flex-wrap items-baseline gap-2 text-sm text-ink-2">
        <DifficultyPill points={problem.points} />
        <span>{TIER_MEANING[problem.points]}</span>
        <span className="text-ink-3">{bandLabel(problem.band)}.</span>
      </p>

      <nav
        aria-label="More problems in this skill"
        className="mt-8 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2"
      >
        {previous ? (
          <Link
            href={`/problem/${previous.id}`}
            rel="prev"
            className="rounded-sm border border-rule bg-surface p-3 no-underline hover:border-rule-strong"
          >
            <span className="block text-2xs text-ink-3">Previous in this skill</span>
            <span className="mono mt-1 block text-sm text-accent-700">{previous.id}</span>
            <span className="mt-1 block text-xs text-ink-2">{previous.points}-point</span>
          </Link>
        ) : (
          <p className="m-0 rounded-sm border border-dashed border-rule p-3 text-xs text-ink-3">
            This is the first problem in {primary ? primary.name : 'this skill'}.
          </p>
        )}

        {next ? (
          <Link
            href={`/problem/${next.id}`}
            rel="next"
            className="rounded-sm border border-rule bg-surface p-3 text-right no-underline hover:border-rule-strong"
          >
            <span className="block text-2xs text-ink-3">Next in this skill</span>
            <span className="mono mt-1 block text-sm text-accent-700">{next.id}</span>
            <span className="mt-1 block text-xs text-ink-2">{next.points}-point</span>
          </Link>
        ) : (
          <p className="m-0 rounded-sm border border-dashed border-rule p-3 text-right text-xs text-ink-3">
            This is the last problem in {primary ? primary.name : 'this skill'}.
          </p>
        )}
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
        <p className="m-0">
          {position && total ? `Problem ${position} of ${total} in this skill.` : null}{' '}
          {primary ? (
            <Link href={`/skill/${primary.id}`} className="no-underline hover:underline">
              See the whole ladder
            </Link>
          ) : null}
        </p>
        {/*
          Reporting an error opens a prefilled GitHub issue rather than a form. It needs no
          backend, it is public and auditable, and the reporter can see the fix land.
        */}
        <a
          href={reportProblemUrl(problem)}
          className="no-underline hover:underline"
          rel="noreferrer"
        >
          Report an error in this problem
        </a>
      </div>
    </div>
  );
}
