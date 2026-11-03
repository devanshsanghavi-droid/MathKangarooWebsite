import type { Choice, Problem, Skill } from './schemas';

/**
 * The slice of the content bank that a measurement needs - and nothing else.
 *
 * `/practice/diagnostic` and `/practice/mock` hand the bank to a client component so the run
 * needs no account and no round trip between questions. Handing over every field of every
 * problem made those two pages the heaviest on the site: the hints, both solutions, the "why
 * this is on the test" line, the calibration, the authoring metadata and above all the
 * misconception behind every wrong choice are all serialised into the page, and on Cloudflare
 * the worker parses that payload on every request against a 10 ms CPU budget.
 *
 * None of it is used there. An assessment shows the statement, the figure and the five choices,
 * never feedback, hints or a solution (see `ProblemCardView`), and the diagnostic and mock logic
 * only read ids, bands, point tiers, skill tags and which choice is correct. So these types are
 * exactly that, and the projections below build fresh objects rather than casting - structural
 * typing would otherwise let a full `Problem` through with every field still attached.
 *
 * A full `Problem` and `Skill` are assignable to these types, so the pure logic in
 * `diagnostic.ts` and `mock.ts` still accepts the whole bank (the unit tests use it that way).
 */

export type AssessmentChoice = Pick<Choice, 'key' | 'text' | 'correct'>;

export interface AssessmentProblem extends Pick<
  Problem,
  'id' | 'band' | 'points' | 'statement' | 'figure' | 'estSeconds'
> {
  choices: readonly AssessmentChoice[];
  skills: { primary: string; secondary: readonly string[] };
}

export type AssessmentSkill = Pick<
  Skill,
  'id' | 'strand' | 'tier' | 'bands' | 'prerequisites' | 'unlocks'
>;

export function toAssessmentProblem(problem: Problem): AssessmentProblem {
  return {
    id: problem.id,
    band: problem.band,
    points: problem.points,
    statement: problem.statement,
    figure: problem.figure
      ? { component: problem.figure.component, alt: problem.figure.alt }
      : null,
    estSeconds: problem.estSeconds,
    choices: problem.choices.map((choice) => ({
      key: choice.key,
      text: choice.text,
      correct: choice.correct,
    })),
    skills: { primary: problem.skills.primary, secondary: [...problem.skills.secondary] },
  };
}

export function toAssessmentSkill(skill: Skill): AssessmentSkill {
  return {
    id: skill.id,
    strand: skill.strand,
    tier: skill.tier,
    bands: [...skill.bands],
    prerequisites: [...skill.prerequisites],
    unlocks: [...skill.unlocks],
  };
}
