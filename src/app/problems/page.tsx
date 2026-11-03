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
import { ProblemTable, StatusLegend, type ProblemRow } from '@/components/problems/ProblemTable';
import { StatusFilteredTable } from '@/components/problems/StatusFilteredTable';
import { RandomUnsolved } from '@/components/problems/RandomUnsolved';
import type { Problem } from '@/lib/schemas';
import { ProgressBanner } from '@/components/progress/ProgressBanner';

export const metadata: Metadata = {
  title: 'Browse the problems',
  description:
    'Every problem in the bank, filterable by level, point value, strand and skill. All ' +
    'original, all with an explanation written for each wrong answer.',
  alternates: { canonical: '/problems' },
};

function toRow(problem: Problem): ProblemRow {
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
}

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

      <div className="mt-4">
        <RandomUnsolved
          candidates={filtered.map((problem) => ({
            id: problem.id,
            skillIds: [problem.skills.primary, ...problem.skills.secondary],
          }))}
        />
      </div>

      <StatusLegend />

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            action={<Link href={problemsHref({ sort: query.sort })}>Clear all filters</Link>}
          >
            No problem matches these filters. There are {stats.problems} problems in the bank
            altogether, across every level from 1–2 to 11–12.
          </EmptyState>
        </div>
      ) : query.status === 'all' ? (
        <>
          <ProblemTable rows={page.items.map(toRow)} showSolveRate={calibrated > 0} />
          <Pagination page={page} href={(number) => problemsHref({ ...query, page: number })} />
        </>
      ) : (
        /*
          Status is the one filter the server cannot apply: progress lives in the student's
          browser. So the whole matching list goes to the client, which narrows and paginates.
          Only on this path - the default view stays twelve server-rendered rows.
        */
        <StatusFilteredTable
          rows={filtered.map(toRow)}
          query={query}
          showSolveRate={calibrated > 0}
        />
      )}

      {calibrated === 0 ? (
        <p className="mt-4 mb-0 text-xs text-ink-3">
          Solve rates are not yet calibrated for any problem. Each one gets a measured rate once 30
          students have tried it, and the column appears then.
        </p>
      ) : null}
    </div>
  );
}
