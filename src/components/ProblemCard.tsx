import type { Problem } from '@/lib/schemas';
import { getSkillsForProblem } from '@/lib/content';
import { ProblemCardView } from './ProblemCardView';

/**
 * The server wrapper: resolves the problem's skills from the content index, then hands them to
 * the presentational card. Split in two because `@/lib/content` is server-only and the
 * authoring form previews a problem from a client component - see ProblemCardView.
 */
export function ProblemCard({
  problem,
  headingLevel = 2,
  headingSuffix,
  showSkills = true,
  linkToProblem = false,
}: {
  problem: Problem;
  headingLevel?: 1 | 2 | 3;
  headingSuffix?: string;
  showSkills?: boolean;
  linkToProblem?: boolean;
}) {
  const { primary, secondary } = getSkillsForProblem(problem);

  return (
    <ProblemCardView
      problem={problem}
      {...(primary ? { primarySkill: primary } : {})}
      secondarySkills={secondary}
      unresolvedPrimary={primary ? null : problem.skills.primary}
      headingLevel={headingLevel}
      {...(headingSuffix === undefined ? {} : { headingSuffix })}
      showSkills={showSkills}
      linkToProblem={linkToProblem}
    />
  );
}
