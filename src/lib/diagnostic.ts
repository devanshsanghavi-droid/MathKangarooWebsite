import { STRANDS, type Band, type Points, type Strand } from './schemas';
import type { AssessmentProblem, AssessmentSkill } from './assessment';

/**
 * The adaptive diagnostic, from `docs/01-DATA-MODEL.md` §3.4.
 *
 *   Start at two 3-point items in the student's band. On a miss, descend to a prerequisite
 *   skill; on a solve, ascend to an unlocked skill and raise the point tier. Stop at 15 items
 *   or when the frontier is bounded on all seven strands.
 *
 * It branches on the **skill graph**, not on raw difficulty. That is the whole point: missing a
 * 4-point counting question should send a student to the counting skill underneath it, not to
 * an easier question about something unrelated.
 *
 * Everything here is pure. The content is passed in, the state is plain JSON, and nothing reads
 * a clock or a database - which is what lets `/practice/diagnostic` run entirely signed-out with
 * the state in `localStorage`, exactly as `docs/00-SPEC.md` §2.1 requires.
 */

export const MAX_ITEMS = 15;
export const STARTING_ITEMS = 2;

export interface DiagnosticAnswer {
  problemId: string;
  skillId: string;
  strand: Strand;
  points: Points;
  correct: boolean;
}

export interface DiagnosticState {
  band: Band;
  answers: DiagnosticAnswer[];
  /**
   * Per strand: the skill we are currently probing, the point tier, and whether we have run out
   * of room to move in either direction. A bounded strand is one we have learned all we can.
   */
  frontier: Record<Strand, { skillId: string | null; points: Points; bounded: boolean }>;
}

/**
 * Only the fields the branching reads (see `./assessment`). A full `Skill` / `Problem` is
 * assignable, so the whole bank can still be passed in.
 */
export interface DiagnosticContent {
  skills: readonly AssessmentSkill[];
  /** Every problem, already filtered to the bank. */
  problems: readonly AssessmentProblem[];
}

export interface StrandEstimate {
  strand: Strand;
  asked: number;
  correct: number;
  /** The hardest skill answered correctly, or null. */
  reached: string | null;
  /** Skills missed in this strand, in the order they were met. */
  missed: string[];
}

export interface PlanWeek {
  week: number;
  skillIds: string[];
}

export interface DiagnosticResult {
  band: Band;
  asked: number;
  correct: number;
  strands: StrandEstimate[];
  /** Six weeks of skills, weakest prerequisite first. */
  plan: PlanWeek[];
  /** Every skill the plan covers, in order. */
  planOrder: string[];
}

/* -------------------------------------------------------------------------- */
/* Graph helpers                                                               */
/* -------------------------------------------------------------------------- */

function indexSkills(skills: readonly AssessmentSkill[]): Map<string, AssessmentSkill> {
  return new Map(skills.map((skill) => [skill.id, skill]));
}

/** Problems that lead with this skill, at this point tier, sorted so choice is deterministic. */
function problemsFor(
  content: DiagnosticContent,
  skillId: string,
  points: Points,
  band: Band,
): AssessmentProblem[] {
  return content.problems
    .filter(
      (problem) =>
        problem.skills.primary === skillId && problem.points === points && problem.band === band,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Any problem for the skill at that tier, whatever the band.
 *
 * The band filter is a preference, not a constraint: with 150 problems a band-and-tier
 * combination is often empty, and asking a slightly off-band question is far better than
 * abandoning a strand and reporting nothing about it.
 */
function problemsForAnyBand(
  content: DiagnosticContent,
  skillId: string,
  points: Points,
): AssessmentProblem[] {
  return content.problems
    .filter((problem) => problem.skills.primary === skillId && problem.points === points)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function lowerTier(points: Points): Points | null {
  if (points === 5) return 4;
  if (points === 4) return 3;
  return null;
}

function higherTier(points: Points): Points | null {
  if (points === 3) return 4;
  if (points === 4) return 5;
  return null;
}

/** The first skill of a strand to probe: a foundation skill that actually has a 3-point problem. */
export function openingSkill(
  content: DiagnosticContent,
  strand: Strand,
  band: Band,
): string | null {
  const candidates = content.skills
    .filter((skill) => skill.strand === strand && skill.bands.includes(band))
    .sort((a, b) => {
      const tier = ['foundation', 'core', 'gateway'];
      return tier.indexOf(a.tier) - tier.indexOf(b.tier) || a.id.localeCompare(b.id);
    });
  const withProblem = candidates.find(
    (skill) => problemsFor(content, skill.id, 3, band).length > 0,
  );
  if (withProblem) return withProblem.id;
  const anyBand = candidates.find((skill) => problemsForAnyBand(content, skill.id, 3).length > 0);
  return anyBand?.id ?? candidates[0]?.id ?? null;
}

export function startDiagnostic(content: DiagnosticContent, band: Band): DiagnosticState {
  const frontier = Object.fromEntries(
    STRANDS.map((strand) => [
      strand,
      { skillId: openingSkill(content, strand, band), points: 3 as Points, bounded: false },
    ]),
  ) as DiagnosticState['frontier'];

  return { band, answers: [], frontier };
}

/**
 * Which strand to probe next.
 *
 * Round-robin over the strands that are still unbounded, least-asked first. Spreading the
 * fifteen items across seven strands is what makes the result a map rather than a deep dive
 * into whichever strand the student happened to fail first.
 */
export function nextStrand(state: DiagnosticState): Strand | null {
  const asked = new Map<Strand, number>(STRANDS.map((strand) => [strand, 0]));
  for (const answer of state.answers) {
    asked.set(answer.strand, (asked.get(answer.strand) ?? 0) + 1);
  }

  const open = STRANDS.filter(
    (strand) => !state.frontier[strand].bounded && state.frontier[strand].skillId !== null,
  );
  if (open.length === 0) return null;

  return (
    open.sort(
      (a, b) =>
        (asked.get(a) ?? 0) - (asked.get(b) ?? 0) || STRANDS.indexOf(a) - STRANDS.indexOf(b),
    )[0] ?? null
  );
}

export function isFinished(state: DiagnosticState): boolean {
  if (state.answers.length >= MAX_ITEMS) return true;
  return STRANDS.every((strand) => state.frontier[strand].bounded);
}

/** The next problem to ask, or null when the diagnostic is over. */
export function nextItem(
  content: DiagnosticContent,
  state: DiagnosticState,
): AssessmentProblem | null {
  if (isFinished(state)) return null;

  const seen = new Set(state.answers.map((answer) => answer.problemId));
  const strand = nextStrand(state);
  if (!strand) return null;

  const { skillId, points } = state.frontier[strand];
  if (!skillId) return null;

  const inBand = problemsFor(content, skillId, points, state.band).find((p) => !seen.has(p.id));
  if (inBand) return inBand;
  return problemsForAnyBand(content, skillId, points).find((p) => !seen.has(p.id)) ?? null;
}

/**
 * Record an answer and move that strand's frontier.
 *
 * Correct: climb to a skill this one unlocks and raise the tier. Wrong: descend to a
 * prerequisite and lower the tier. When there is nowhere left to move, or no problem exists
 * where we would move to, the strand is bounded and we stop spending items on it.
 */
export function recordAnswer(
  content: DiagnosticContent,
  state: DiagnosticState,
  problem: AssessmentProblem,
  correct: boolean,
): DiagnosticState {
  const skills = indexSkills(content.skills);
  const skillId = problem.skills.primary;
  const strand = (skillId.slice(0, 3) as Strand) ?? 'NUM';
  const skill = skills.get(skillId);

  const answers = [
    ...state.answers,
    { problemId: problem.id, skillId, strand, points: problem.points, correct },
  ];

  const current = state.frontier[strand];
  let nextSkillId: string | null = null;
  let nextPoints: Points = current.points;

  if (skill) {
    const seen = new Set(answers.map((answer) => answer.skillId));
    const candidates = (correct ? skill.unlocks : skill.prerequisites)
      .filter((id) => !seen.has(id))
      .sort();
    nextSkillId = candidates[0] ?? null;
    nextPoints =
      (correct ? higherTier(current.points) : lowerTier(current.points)) ?? current.points;
  }

  const hasProblem =
    nextSkillId !== null &&
    (problemsFor(content, nextSkillId, nextPoints, state.band).length > 0 ||
      problemsForAnyBand(content, nextSkillId, nextPoints).length > 0);

  const frontier = {
    ...state.frontier,
    [strand]: hasProblem
      ? { skillId: nextSkillId, points: nextPoints, bounded: false }
      : { skillId: nextSkillId, points: nextPoints, bounded: true },
  };

  return { ...state, answers, frontier };
}

/* -------------------------------------------------------------------------- */
/* The result                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The six-week plan: every missed skill plus the prerequisites it rests on, ordered so nothing
 * is studied before what it needs. That ordering is the entire value of having a graph - a plan
 * that puts "invariants" before "parity" is a list, not a plan.
 */
export function buildPlan(content: DiagnosticContent, state: DiagnosticState): string[] {
  const skills = indexSkills(content.skills);
  const missed = state.answers.filter((answer) => !answer.correct).map((answer) => answer.skillId);
  const solved = new Set(
    state.answers.filter((answer) => answer.correct).map((answer) => answer.skillId),
  );

  // Pull in every prerequisite of a missed skill that the student has not demonstrated.
  const needed = new Set<string>();
  const visit = (id: string) => {
    if (needed.has(id) || solved.has(id)) return;
    needed.add(id);
    for (const prereq of skills.get(id)?.prerequisites ?? []) visit(prereq);
  };
  for (const id of missed) visit(id);

  // Topological order over the needed set, prerequisites first, ties broken on id so two
  // students with the same answers get the same plan.
  const ordered: string[] = [];
  const placed = new Set<string>();
  let progressed = true;
  while (placed.size < needed.size && progressed) {
    progressed = false;
    for (const id of [...needed].sort()) {
      if (placed.has(id)) continue;
      const prereqs = (skills.get(id)?.prerequisites ?? []).filter((p) => needed.has(p));
      if (!prereqs.every((p) => placed.has(p))) continue;
      ordered.push(id);
      placed.add(id);
      progressed = true;
    }
  }
  // Only reachable on a cyclic graph, which CI forbids; append rather than drop.
  for (const id of [...needed].sort()) if (!placed.has(id)) ordered.push(id);

  return ordered;
}

export function summarise(content: DiagnosticContent, state: DiagnosticState): DiagnosticResult {
  const strands: StrandEstimate[] = STRANDS.map((strand) => {
    const answers = state.answers.filter((answer) => answer.strand === strand);
    const correctAnswers = answers.filter((answer) => answer.correct);
    return {
      strand,
      asked: answers.length,
      correct: correctAnswers.length,
      reached: correctAnswers.at(-1)?.skillId ?? null,
      missed: answers.filter((answer) => !answer.correct).map((answer) => answer.skillId),
    };
  });

  const planOrder = buildPlan(content, state);
  // Six weeks, spread evenly, prerequisites first. An empty week is honest: a student who
  // missed two things does not need six weeks of work invented for them.
  const perWeek = Math.ceil(planOrder.length / 6);
  const plan: PlanWeek[] = Array.from({ length: 6 }, (_, index) => ({
    week: index + 1,
    skillIds: perWeek === 0 ? [] : planOrder.slice(index * perWeek, (index + 1) * perWeek),
  }));

  return {
    band: state.band,
    asked: state.answers.length,
    correct: state.answers.filter((answer) => answer.correct).length,
    strands,
    plan,
    planOrder,
  };
}
