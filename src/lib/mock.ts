import { POINT_VALUES, type Band, type ChoiceKey, type Points } from './schemas';
import type { AssessmentProblem } from './assessment';
import { seededRandom, shuffle } from './worksheet';

/**
 * The full simulated exam, from `docs/00-SPEC.md` §2.3 and `docs/01-DATA-MODEL.md` §3.5.
 *
 *   Bands 1-2 and 3-4: 24 items, 8 at each of 3, 4 and 5 points, out of 96.
 *   Bands 5-6 upward:  30 items, 10 at each tier, out of 120.
 *   75 minutes. No deduction for a wrong answer, so a blank is never the better choice.
 *
 * Pure, and the state is plain JSON: the run has to survive a refresh at minute 40 with the
 * timer intact, and the only way to mean that is to store when it started and compute the
 * remaining time from the wall clock rather than counting down in memory.
 */

export const MOCK_MINUTES = 75;
export const MOCK_DURATION_MS = MOCK_MINUTES * 60_000;
/** When to nudge about blanks. Wrong answers cost nothing, so a blank is a decision to score 0. */
export const NUDGE_AT_MS = 5 * 60_000;

export function itemsPerTier(band: Band): number {
  return band === '1-2' || band === '3-4' ? 8 : 10;
}

export function paperSize(band: Band): number {
  return itemsPerTier(band) * 3;
}

export function maxScore(band: Band): number {
  const per = itemsPerTier(band);
  return per * 3 + per * 4 + per * 5;
}

export interface MockAnswer {
  problemId: string;
  chosenKey: ChoiceKey | null;
  flagged: boolean;
  /** Milliseconds spent with this question on screen, accumulated across visits. */
  msSpent: number;
}

export interface MockState {
  band: Band;
  seed: number;
  /** Wall-clock start, so a refresh restores the timer rather than resetting it. */
  startedAt: string;
  finishedAt: string | null;
  problemIds: string[];
  answers: Record<string, MockAnswer>;
  current: number;
}

export interface BuildResult {
  problemIds: string[];
  /** Short by tier, when the bank cannot fill the paper. Empty when it can. */
  shortfall: Array<{ points: Points; wanted: number; available: number }>;
}

/**
 * Build the paper: exactly the right number at each tier, drawn deterministically from the
 * seed so the same seed is the same paper.
 *
 * When the bank cannot fill a tier, the shortfall is reported rather than silently building a
 * short paper. A 22-question "mock" scored out of 96 would be worse than no mock at all: the
 * student would draw a conclusion from a number that does not mean what they think.
 */
export function buildPaper(
  problems: readonly AssessmentProblem[],
  band: Band,
  seed: number,
): BuildResult {
  const per = itemsPerTier(band);
  const problemIds: string[] = [];
  const shortfall: BuildResult['shortfall'] = [];

  for (const points of POINT_VALUES) {
    const eligible = problems
      .filter((problem) => problem.band === band && problem.points === points)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (eligible.length < per) {
      shortfall.push({ points, wanted: per, available: eligible.length });
    }
    // Vary the draw per tier so one seed does not take the same slice from each.
    problemIds.push(
      ...shuffle(eligible, seed + points)
        .slice(0, per)
        .map((p) => p.id),
    );
  }

  // Real papers run easiest first, in tier order; keep that so the pacing is the same.
  return { problemIds, shortfall };
}

export function startMock(
  problems: readonly AssessmentProblem[],
  band: Band,
  seed: number,
  now: Date,
): MockState | null {
  const { problemIds, shortfall } = buildPaper(problems, band, seed);
  if (shortfall.length > 0) return null;
  return {
    band,
    seed,
    startedAt: now.toISOString(),
    finishedAt: null,
    problemIds,
    answers: Object.fromEntries(
      problemIds.map((id) => [id, { problemId: id, chosenKey: null, flagged: false, msSpent: 0 }]),
    ),
    current: 0,
  };
}

/** Milliseconds left, floored at zero. Computed from the clock, never counted down in memory. */
export function remainingMs(state: MockState, now: Date): number {
  if (state.finishedAt) return 0;
  const elapsed = now.getTime() - new Date(state.startedAt).getTime();
  return Math.max(0, MOCK_DURATION_MS - elapsed);
}

export function isExpired(state: MockState, now: Date): boolean {
  return remainingMs(state, now) === 0;
}

export function shouldNudge(state: MockState, now: Date): boolean {
  if (state.finishedAt) return false;
  const left = remainingMs(state, now);
  return left > 0 && left <= NUDGE_AT_MS && countBlanks(state) > 0;
}

export function countBlanks(state: MockState): number {
  return Object.values(state.answers).filter((answer) => answer.chosenKey === null).length;
}

export function countFlagged(state: MockState): number {
  return Object.values(state.answers).filter((answer) => answer.flagged).length;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/* Scoring and the report                                                      */
/* -------------------------------------------------------------------------- */

export interface TierResult {
  points: Points;
  asked: number;
  correct: number;
  blank: number;
  scored: number;
}

export interface SkillHeat {
  skillId: string;
  asked: number;
  correct: number;
}

export interface MockReport {
  band: Band;
  score: number;
  maxScore: number;
  answered: number;
  blanks: number;
  tiers: TierResult[];
  /** One point per question: time spent against whether it was right. */
  scatter: Array<{ problemId: string; points: Points; seconds: number; correct: boolean }>;
  skills: SkillHeat[];
  /** The three skills to fix first, worst first. */
  topFixes: string[];
  /** Points left on the table by leaving questions blank. */
  blankCost: number;
}

export function scoreMock(problems: readonly AssessmentProblem[], state: MockState): MockReport {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const tiers = new Map<Points, TierResult>(
    POINT_VALUES.map((points) => [points, { points, asked: 0, correct: 0, blank: 0, scored: 0 }]),
  );
  const skills = new Map<string, SkillHeat>();
  const scatter: MockReport['scatter'] = [];
  let score = 0;
  let blanks = 0;
  let blankCost = 0;

  for (const id of state.problemIds) {
    const problem = byId.get(id);
    const answer = state.answers[id];
    if (!problem || !answer) continue;

    const tier = tiers.get(problem.points);
    if (tier) tier.asked += 1;

    const correct =
      answer.chosenKey !== null &&
      problem.choices.some((choice) => choice.key === answer.chosenKey && choice.correct);

    if (answer.chosenKey === null) {
      blanks += 1;
      blankCost += problem.points;
      if (tier) tier.blank += 1;
    } else if (correct) {
      score += problem.points;
      if (tier) {
        tier.correct += 1;
        tier.scored += problem.points;
      }
    }

    scatter.push({
      problemId: id,
      points: problem.points,
      seconds: Math.round(answer.msSpent / 1000),
      correct,
    });

    for (const skillId of [problem.skills.primary, ...problem.skills.secondary]) {
      const heat = skills.get(skillId) ?? { skillId, asked: 0, correct: 0 };
      heat.asked += 1;
      if (correct) heat.correct += 1;
      skills.set(skillId, heat);
    }
  }

  // Worst first: lowest accuracy, then most asked, then id - so the list is stable and the
  // skill you got wrong twice outranks the one you got wrong once.
  const ranked = [...skills.values()].sort(
    (a, b) =>
      a.correct / a.asked - b.correct / b.asked ||
      b.asked - a.asked ||
      a.skillId.localeCompare(b.skillId),
  );

  return {
    band: state.band,
    score,
    maxScore: maxScore(state.band),
    answered: state.problemIds.length - blanks,
    blanks,
    tiers: [...tiers.values()],
    scatter,
    skills: ranked,
    topFixes: ranked
      .filter((heat) => heat.correct < heat.asked)
      .slice(0, 3)
      .map((h) => h.skillId),
    blankCost,
  };
}

/** A seed that changes daily without needing a clock inside a pure function. */
export function seedForDate(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

export { seededRandom };
