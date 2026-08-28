import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getContentStats, getSkill, getSkillsForProblem } from '@/lib/content';
import {
  matches,
  paginate,
  parseProblemQuery,
  problemsHref,
  sortProblems,
  type RawSearchParams,
} from '@/lib/problem-query';
import { ProblemFilters } from '@/components/problems/ProblemFilters';
import { Pagination } from '@/components/problems/Pagination';
import { PointPill } from '@/components/PointPill';
import { BandPill } from '@/components/BandPill';
import { EmptyState } from '@/components/EmptyState';

export const metadata: Metadata = {
  title: 'Browse the problems',
  description:
    'Every problem in the bank, filterable by level, point value, strand and skill. All ' +
    'original, all with an explanation written for each wrong answer.',
  alternates: { canonical: '/problems' },
};

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseProblemQuery(await searchParams);
  const all = getAllProblems();
  const filtered = sortProblems(
    all.filter((problem) => matches(problem, query)),
    query.sort,
  );
  const page = paginate(filtered, query.page);
  const stats = getContentStats();
  const skill = query.skill ? getSkill(query.skill) : undefined;
  const calibrated = all.filter((problem) => problem.calibration.pValue !== null).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Browse the problems</h1>
        <p className="mt-3 mb-0 text-ink-2">
          {stats.problems} problems, every one written from scratch, every wrong answer carrying the
          mistake that produces it. {stats.misconceptions} explanations in all.
        </p>
      </header>

      <div className="mt-6">
        <ProblemFilters
          query={query}
          resultCount={filtered.length}
          skill={skill}
          calibrated={calibrated}
        />
      </div>

      {page.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            action={<Link href={problemsHref({ sort: query.sort })}>Clear all filters</Link>}
          >
            No problem matches these filters. There are {stats.problems} problems in the bank
            altogether, across levels 3–4 and 5–6.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid list-none gap-3 p-0">
          {page.items.map((problem) => {
            const { primary, secondary } = getSkillsForProblem(problem);
            return (
              <li key={problem.id}>
                <article className="rounded-md border border-rule bg-surface p-4 transition-colors hover:border-rule-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-sm font-normal">
                      <Link
                        href={`/problem/${problem.id}`}
                        className="mono no-underline hover:underline"
                      >
                        {problem.id}
                      </Link>
                    </h2>
                    <PointPill points={problem.points} showMeaning />
                    <BandPill band={problem.band} />
                    {problem.figure ? (
                      <span className="mono text-2xs text-ink-3">has a figure</span>
                    ) : null}
                    <span className="mono ml-auto text-2xs text-ink-3">
                      {problem.calibration.pValue === null
                        ? 'not yet calibrated'
                        : `${Math.round(problem.calibration.pValue * 100)}% solve it`}
                    </span>
                  </div>

                  <p className="serif prose-measure mt-3 mb-0 text-ink">
                    <Link
                      href={`/problem/${problem.id}`}
                      className="text-ink no-underline hover:underline"
                    >
                      {problem.statement}
                    </Link>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {primary ? (
                      <Link href={`/skill/${primary.id}`} className="no-underline hover:underline">
                        <span className="mono mr-1.5 text-2xs text-ink-3">{primary.id}</span>
                        {primary.name}
                      </Link>
                    ) : null}
                    {secondary.length > 0 ? (
                      <span className="text-ink-3">
                        also {secondary.map((s) => s.id).join(', ')}
                      </span>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} href={(number) => problemsHref({ ...query, page: number })} />
    </div>
  );
}
