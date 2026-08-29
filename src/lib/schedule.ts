import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';
import type { Points, Problem } from './schemas';
import type { AttemptRecord } from './mastery';

/**
 * Spaced repetition over SKILLS, not problems - `docs/01-DATA-MODEL.md` §3.2.
 *
 * FSRS schedules the skill. When a skill comes due, the server serves a problem from it that
 * the student has not seen. That distinction is the whole design: schedule the problem and a
 * student eventually answers from memory of that item; schedule the skill and they have to do
 * the thinking again on something new.
 *
 * Fuzz is off. Fuzz spreads reviews to stop a pile-up, which matters for a thousand-card deck;
 * here it would only make the scheduler non-deterministic and its tests flaky, for a bank of
 * 91 skills that a student meets a handful of times a week.
 */

const parameters = generatorParameters({ enable_fuzz: false });
const scheduler = fsrs(parameters);

export type SkillCard = Card;

export interface SkillSchedule {
  skillId: string;
  card: SkillCard;
}

export function newSkillCard(now: Date): SkillCard {
  return createEmptyCard(now);
}

/**
 * How an attempt becomes an FSRS rating.
 *
 * The mapping is deliberately strict about hints. A correct answer that needed the strategy or
 * the full solution is not the same as one the student found alone, and rating it Good would
 * push the next review too far out - the student would meet the skill again having never
 * actually done it unaided.
 *
 *   wrong                          -> Again
 *   right, but needed hint 2 or 3  -> Hard
 *   right, needed only the nudge   -> Good
 *   right, unaided and inside the estimated time -> Easy
 *   right, unaided but slow        -> Good
 */
export function ratingFor(attempt: {
  correct: boolean;
  hintsUsed: number;
  msElapsed?: number;
  estSeconds?: number;
}): Grade {
  if (!attempt.correct) return Rating.Again;
  if (attempt.hintsUsed >= 2) return Rating.Hard;
  if (attempt.hintsUsed === 1) return Rating.Good;
  const withinTime =
    attempt.msElapsed !== undefined &&
    attempt.estSeconds !== undefined &&
    attempt.msElapsed <= attempt.estSeconds * 1000;
  return withinTime ? Rating.Easy : Rating.Good;
}

/** Advance a skill's card by one review. Pure: the card in is never mutated. */
export function reviewSkill(card: SkillCard, rating: Grade, now: Date): SkillCard {
  return scheduler.next(card, now, rating).card;
}

export function isDue(card: SkillCard, now: Date): boolean {
  // A brand-new card is due immediately: it has never been seen, so there is nothing to wait for.
  if (card.state === State.New) return true;
  return card.due.getTime() <= now.getTime();
}

/**
 * The skills to drill next, most overdue first.
 *
 * Ties break on skill id so that two students with identical histories get identical sessions,
 * and so that a test can assert an exact order.
 */
export function dueSkills(
  schedules: readonly SkillSchedule[],
  now: Date,
  limit?: number,
): SkillSchedule[] {
  const due = schedules
    .filter((entry) => isDue(entry.card, now))
    .sort(
      (a, b) => a.card.due.getTime() - b.card.due.getTime() || a.skillId.localeCompare(b.skillId),
    );
  return limit === undefined ? due : due.slice(0, limit);
}

/**
 * The highest point tier a student should be served in a skill.
 *
 * It starts at 3 and rises only on evidence: a correct unaided answer at the current ceiling
 * lifts it by one. A miss at the ceiling drops it back. Nobody meets a 5-point version of a
 * skill they have not yet solved at 4.
 */
export function pointCeiling(attempts: readonly AttemptRecord[]): Points {
  let ceiling: Points = 3;
  for (const attempt of [...attempts].sort((a, b) => a.at.localeCompare(b.at))) {
    if (attempt.points !== ceiling) continue;
    if (attempt.correct && attempt.hintsUsed <= 1) {
      if (ceiling === 3) ceiling = 4;
      else if (ceiling === 4) ceiling = 5;
    } else if (!attempt.correct) {
      if (ceiling === 5) ceiling = 4;
      else if (ceiling === 4) ceiling = 3;
    }
  }
  return ceiling;
}

/**
 * Pick the problem to serve for a skill.
 *
 * Unseen first, always - the point of scheduling the skill is that the item is new. Among the
 * unseen ones, prefer the highest tier at or below the ceiling, so a student who has earned
 * their way up meets the harder version rather than another easy one. Ties break on id.
 *
 * Returns null when the student has seen every problem in the skill, which is a content gap
 * rather than an error: the caller should say so rather than re-serving an old item.
 */
export function pickProblem({
  problems,
  seenProblemIds,
  ceiling,
}: {
  problems: readonly Problem[];
  seenProblemIds: readonly string[];
  ceiling: Points;
}): Problem | null {
  const seen = new Set(seenProblemIds);
  const candidates = problems
    .filter((problem) => !seen.has(problem.id) && problem.points <= ceiling)
    .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}

export { Rating, State };
export type { Grade };
