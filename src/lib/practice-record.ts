import type { ChoiceKey } from './schemas';
import { saveAmcAttempt, saveAttempt, saveTestAttempt } from './local-progress';
import { track } from './telemetry/client';
import type { Surface } from './telemetry/events';
import type { PracticeItem } from './practice-item';

/**
 * Records a practice attempt the way each bank stores it (local-progress.ts):
 *
 *   Kangaroo  `saveAttempt` against every skill the problem tags, exactly as
 *             <ProblemInteractive> does, plus the same `choice_select` telemetry event.
 *   AMC       `saveAmcAttempt` under the AM id. No telemetry: the event schema only accepts
 *             Kangaroo problem ids, and a payload it rejects is dropped anyway.
 *   SAT / ACT `saveTestAttempt` under `sat:SA-...` / `act:AC-...`, points from difficulty.
 *             No telemetry, for the same reason as AMC.
 *
 * The caller decides WHEN to call this. <PracticeSession> calls it once per question, on the
 * first Check, so changing an answer after feedback can never farm a correct attempt.
 */
export function recordPracticeAttempt(
  item: PracticeItem,
  {
    choiceKey,
    correct,
    hintsUsed,
    surface,
    at = new Date(),
  }: {
    choiceKey: ChoiceKey;
    correct: boolean;
    hintsUsed: number;
    surface: Surface;
    at?: Date;
  },
): void {
  const hints = Math.max(0, Math.min(3, Math.round(hintsUsed)));
  if (item.bank === 'amc') {
    saveAmcAttempt(item.id, item.slot, { correct, hintsUsed: hints, at: at.toISOString() });
    return;
  }
  // SAT or ACT. (Compared against 'ka' because TS narrows a two-literal discriminant this way.)
  if (item.bank !== 'ka') {
    saveTestAttempt(item.id, item.difficulty, {
      correct,
      hintsUsed: hints,
      at: at.toISOString(),
    });
    return;
  }
  saveAttempt(item.skillIds, {
    problemId: item.id,
    points: item.points,
    correct,
    hintsUsed: hints,
    at: at.toISOString(),
  });
  track('choice_select', {
    surface,
    context: 'free',
    problemId: item.id,
    ...(item.skillIds[0] ? { skillId: item.skillIds[0] } : {}),
    points: item.points,
    band: item.band,
    choiceKey,
    correct,
    hintLevel: hints,
  });
}
