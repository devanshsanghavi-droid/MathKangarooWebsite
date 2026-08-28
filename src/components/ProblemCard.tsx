import Link from 'next/link';
import type { Problem } from '@/lib/schemas';
import { getSkillsForProblem } from '@/lib/content';
import { PointPill } from './PointPill';
import { BandPill } from './BandPill';
import { SkillChip, UnknownSkillChip } from './SkillChip';
import { FigureRenderer } from './FigureRenderer';
import { HintLadder } from './HintLadder';
import { SolutionTabs } from './SolutionTabs';
import { ProblemInteractive } from './ProblemInteractive';

/**
 * One problem, whole.
 *
 * A server component: the statement, the figure, the choices, the hints and the solution are
 * all in the delivered HTML. Only the parts that genuinely need state — selecting a choice,
 * gating the hint ladder, switching solution tabs — hydrate. With JavaScript disabled a reader
 * still gets the statement, the five choices, the three hints as plain <details>, and the
 * solution.
 */
export function ProblemCard({
  problem,
  headingLevel = 2,
  showSkills = true,
  linkToProblem = false,
}: {
  problem: Problem;
  headingLevel?: 2 | 3;
  showSkills?: boolean;
  linkToProblem?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const { primary, secondary } = getSkillsForProblem(problem);
  const unresolvedPrimary = primary ? null : problem.skills.primary;

  return (
    <article
      aria-labelledby={`problem-${problem.id}`}
      className="rounded-md border border-rule bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Heading id={`problem-${problem.id}`} className="m-0 text-sm">
          {linkToProblem ? (
            <Link href={`/problem/${problem.id}`} className="mono no-underline hover:underline">
              {problem.id}
            </Link>
          ) : (
            <span className="mono text-ink-3">{problem.id}</span>
          )}
        </Heading>
        <PointPill points={problem.points} showMeaning />
        <BandPill band={problem.band} />
        <span className="mono ml-auto text-2xs text-ink-3">
          about {Math.round(problem.estSeconds / 15) * 15}s
        </span>
      </div>

      <p className="serif prose-measure mt-4 mb-0 text-lg text-ink">{problem.statement}</p>

      {problem.figure ? <FigureRenderer figure={problem.figure} problemId={problem.id} /> : null}

      <div className="mt-5">
        <ProblemInteractive problem={problem} />
      </div>

      <HintLadder problemId={problem.id} hints={problem.hints} />

      <SolutionTabs reliable={problem.solutions.reliable} elegant={problem.solutions.elegant} />

      <p className="mt-6 mb-0 border-t border-rule pt-4 text-sm text-ink-2">
        <span className="font-medium text-ink">Why this is on the test: </span>
        {problem.whyOnTest}
      </p>

      {showSkills ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mono text-2xs text-ink-3">Skills</span>
          {primary ? <SkillChip skill={primary} variant="primary" /> : null}
          {unresolvedPrimary ? <UnknownSkillChip id={unresolvedPrimary} /> : null}
          {secondary.map((skill) => (
            <SkillChip key={skill.id} skill={skill} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
