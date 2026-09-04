import 'server-only';
import { getAllProblems, getAllSkills, getProblemsForSkill } from '../content';
import { POINT_VALUES, STRANDS, type Points } from '../schemas';

/**
 * The half of the admin panel that has data on day one.
 *
 * Telemetry answers "what are students doing", and until students arrive it answers nothing.
 * This answers "what is the bank actually made of", which is derivable from the content files
 * and is the operator's real day-to-day question anyway: where are the gaps, which skills are
 * thin, is anything unreachable.
 */

export interface ContentHealth {
  skills: number;
  problems: number;
  distractors: number;
  figures: number;
  byStrand: Array<{ strand: string; skills: number; problems: number }>;
  byTier: Array<{ points: Points; problems: number; share: number }>;
  /** Skills with no problems at all — the gaps worth authoring into next. */
  uncovered: string[];
  /** Skills whose whole ladder sits on one tier: practisable, but not progressively. */
  singleTier: Array<{ skillId: string; points: Points; count: number }>;
  /** Problems still carrying the placeholder reviewer. */
  pendingReview: number;
}

export function contentHealth(): ContentHealth {
  const skills = getAllSkills();
  const problems = getAllProblems();

  const uncovered: string[] = [];
  const singleTier: ContentHealth['singleTier'] = [];

  for (const skill of skills) {
    const mine = getProblemsForSkill(skill.id);
    if (mine.length === 0) {
      uncovered.push(skill.id);
      continue;
    }
    const tiers = new Set(mine.map((problem) => problem.points));
    if (tiers.size === 1) {
      const only = [...tiers][0] as Points;
      singleTier.push({ skillId: skill.id, points: only, count: mine.length });
    }
  }

  return {
    skills: skills.length,
    problems: problems.length,
    distractors: problems.reduce(
      (total, problem) => total + problem.choices.filter((choice) => !choice.correct).length,
      0,
    ),
    figures: new Set(problems.map((problem) => problem.figure?.component).filter(Boolean)).size,
    byStrand: STRANDS.map((strand) => ({
      strand,
      skills: skills.filter((skill) => skill.strand === strand).length,
      problems: problems.filter((problem) => problem.skills.primary.slice(0, 3) === strand).length,
    })),
    byTier: POINT_VALUES.map((points) => {
      const count = problems.filter((problem) => problem.points === points).length;
      return { points, problems: count, share: problems.length ? count / problems.length : 0 };
    }),
    uncovered,
    singleTier: singleTier.sort((a, b) => a.skillId.localeCompare(b.skillId)),
    pendingReview: problems.filter((problem) => problem.reviewedBy.includes('pending-review'))
      .length,
  };
}
