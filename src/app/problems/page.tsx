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
import { EmptyState } from '@/components/EmptyState';
import { ProblemTable } from '@/components/problems/ProblemTable';
import { ProgressBanner } from '@/components/progress/ProgressBanner';

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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Browse the problems</h1>
        <p className="mt-3 mb-0 text-ink-2">
          {stats.problems} problems, every one written from scratch, every wrong answer carrying the
          mistake that produces it. {stats.misconceptions} explanations in all.
        </p>
      </header>

      <ProgressBanner
        problems={all.map((problem) => ({
          id: problem.id,
          points: problem.points,
          skillIds: [problem.skills.primary, ...problem.skills.secondary],
        }))}
        skillsTotal={stats.skills}
      />

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
            altogether, across levels 3-4 up to 11-12.
          </EmptyState>
        </div>
      ) : (
        <ProblemTable
          rows={page.items.map((problem) => {
            const { primary, secondary } = getSkillsForProblem(problem);
            return {
              id: problem.id,
              band: problem.band,
              points: problem.points,
              statement: problem.statement,
              hasFigure: problem.figure !== null,
              pValue: problem.calibration.pValue,
              skillIds: [problem.skills.primary, ...problem.skills.secondary],
              primarySkill: primary ? { id: primary.id, name: primary.name } : null,
              secondaryCount: secondary.length,
            };
          })}
        />
      )}

      <Pagination page={page} href={(number) => problemsHref({ ...query, page: number })} />
    </div>
  );
}
