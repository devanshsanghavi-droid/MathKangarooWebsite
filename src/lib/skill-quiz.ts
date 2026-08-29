import { POINT_VALUES, type Points, type Problem } from './schemas';

/**
 * Choosing the five problems in a skill quiz — docs/05-DESIGN-DIRECTION.md §7.2, row five.
 *
 * The quiz is the last row of a unit, so it should look like the exam rather than like one
 * rung: two 3-pointers, two 4-pointers and a 5-pointer, backfilled from whatever the skill
 * actually has when a tier is short. Deterministic — the same skill always gives the same five
 * problems — because a quiz whose contents change on reload cannot be discussed with a tutor.
 */

export const QUIZ_SIZE = 5;

const WANTED: Record<Points, number> = { 3: 2, 4: 2, 5: 1 };

export function pickQuizProblems(problems: readonly Problem[]): Problem[] {
  const byTier = new Map<Points, Problem[]>(
    POINT_VALUES.map((points) => [
      points,
      problems
        .filter((problem) => problem.points === points)
        .sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  );

  const chosen: Problem[] = [];
  for (const points of POINT_VALUES) {
    chosen.push(...(byTier.get(points) ?? []).slice(0, WANTED[points]));
  }

  // Backfill in id order from everything not already taken, so a skill with only 3-pointers
  // still gets a five-question quiz rather than two.
  if (chosen.length < QUIZ_SIZE) {
    const taken = new Set(chosen.map((problem) => problem.id));
    const rest = [...problems]
      .filter((problem) => !taken.has(problem.id))
      .sort((a, b) => a.points - b.points || a.id.localeCompare(b.id));
    chosen.push(...rest.slice(0, QUIZ_SIZE - chosen.length));
  }

  return chosen.slice(0, QUIZ_SIZE).sort((a, b) => a.points - b.points || a.id.localeCompare(b.id));
}
