import Link from 'next/link';
import type { ChoiceKey, Problem, Skill } from '@/lib/schemas';
import { PointPill } from './PointPill';
import { ChoiceList } from './ChoiceList';
import { BandPill } from './BandPill';
import { SkillChip, UnknownSkillChip } from './SkillChip';
import { FigureRenderer } from './FigureRenderer';
import { HintLadder } from './HintLadder';
import { SolutionTabs } from './SolutionTabs';
import { ProblemInteractive } from './ProblemInteractive';

/**
 * One problem, whole - the presentational half.
 *
 * It takes its skills as props rather than looking them up, which is what lets it be rendered
 * from a client component: `@/lib/content` is server-only, and importing it into a client
 * bundle fails the build. `<ProblemCard>` is the server wrapper that does the lookup; the
 * authoring form's live preview uses this directly.
 *
 * Everything here except choice selection, hint gating and tab switching is plain markup, so a
 * reader without JavaScript still gets the statement, the five choices, the three hints as
 * <details>, and the solution.
 *
 * Two modes:
 *
 *   practice     the default. Distractor feedback on selection, the hint ladder, the solution,
 *                and why the problem is on the test. This is the product.
 *   assessment   a measurement. The choices are buttons and nothing else is shown: no feedback,
 *                no hints, no solution. A diagnostic that let a student open the full solution
 *                mid-run would measure nothing, and one that revealed each answer would teach
 *                them to stop after the first miss.
 */
export function ProblemCardView({
  problem,
  primarySkill,
  secondarySkills = [],
  unresolvedPrimary = null,
  headingLevel = 2,
  headingSuffix,
  showSkills = true,
  linkToProblem = false,
  mode = 'practice',
  onAnswer,
}: {
  problem: Problem;
  primarySkill?: Pick<Skill, 'id' | 'name'> | undefined;
  secondarySkills?: readonly Pick<Skill, 'id' | 'name'>[];
  unresolvedPrimary?: string | null;
  /** 1 on `/problem/[id]`, where the problem is the page; 2 or 3 when it sits inside a list. */
  headingLevel?: 1 | 2 | 3;
  /** Appended to the id in the heading, e.g. the primary skill's name on the problem page. */
  headingSuffix?: string;
  showSkills?: boolean;
  linkToProblem?: boolean;
  /** 'assessment' hides feedback, hints and the solution. See the note above. */
  mode?: 'practice' | 'assessment';
  /** Called with the chosen key in assessment mode. Ignored in practice mode. */
  onAnswer?: (key: ChoiceKey) => void;
}) {
  const Heading = (['h1', 'h2', 'h3'] as const)[headingLevel - 1] ?? 'h2';
  const assessing = mode === 'assessment';

  return (
    <article
      aria-labelledby={`problem-${problem.id}`}
      className="rounded-md border border-rule bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Heading id={`problem-${problem.id}`} className="m-0 text-sm font-normal">
          {linkToProblem ? (
            <Link href={`/problem/${problem.id}`} className="mono no-underline hover:underline">
              {problem.id}
            </Link>
          ) : (
            <span className="mono text-ink-3">{problem.id}</span>
          )}
          {headingSuffix ? (
            <span className="ml-2 font-medium text-ink">{headingSuffix}</span>
          ) : null}
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
        {assessing ? (
          <ChoiceList
            choices={problem.choices}
            selected={null}
            onSelect={(key) => onAnswer?.(key)}
            idPrefix={`assess-${problem.id}`}
          />
        ) : (
          <ProblemInteractive problem={problem} />
        )}
      </div>

      {assessing ? null : (
        <>
          <HintLadder problemId={problem.id} hints={problem.hints} />

          <SolutionTabs reliable={problem.solutions.reliable} elegant={problem.solutions.elegant} />

          <p className="mt-6 mb-0 border-t border-rule pt-4 text-sm text-ink-2">
            <span className="font-medium text-ink">Why this is on the test: </span>
            {problem.whyOnTest}
          </p>
        </>
      )}

      {showSkills ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mono text-2xs text-ink-3">Skills</span>
          {primarySkill ? <SkillChip skill={primarySkill} variant="primary" /> : null}
          {unresolvedPrimary ? <UnknownSkillChip id={unresolvedPrimary} /> : null}
          {secondarySkills.map((skill) => (
            <SkillChip key={skill.id} skill={skill} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
