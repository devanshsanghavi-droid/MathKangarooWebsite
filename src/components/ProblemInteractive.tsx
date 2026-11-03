'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChoiceKey, Problem } from '@/lib/schemas';
import { saveAttempt } from '@/lib/local-progress';
import { track } from '@/lib/telemetry/client';
import { ChoiceList } from './ChoiceList';
import { FeedbackPanel } from './FeedbackPanel';

/**
 * Holds the one piece of state the choice list and the feedback panel share: which key the
 * student picked. Kept as its own component so `ChoiceList` and `FeedbackPanel` stay
 * independently testable and so `<ProblemCard>` can remain a server component.
 *
 * A student may change their answer. Kangaroo has no penalty for a wrong answer and the point
 * of this page is to learn, not to score, so locking the first click would only teach students
 * to be afraid of clicking.
 *
 * Only the FIRST pick is recorded, exactly as the ladder does. Changing an answer after the
 * feedback has said which misconception you hit would otherwise let a student click through to
 * a "correct" attempt that measures nothing, and those attempts feed skill mastery. Hints only
 * appear after a pick, so the first pick is always made with none taken.
 */
export function ProblemInteractive({ problem }: { problem: Problem }) {
  const [selected, setSelected] = useState<ChoiceKey | null>(null);
  const scored = useRef(false);

  const onSelect = useCallback(
    (key: ChoiceKey) => {
      setSelected(key);
      if (scored.current) return;
      scored.current = true;
      const correct = problem.choices.some((choice) => choice.key === key && choice.correct);
      saveAttempt([problem.skills.primary, ...problem.skills.secondary], {
        problemId: problem.id,
        points: problem.points,
        correct,
        hintsUsed: 0,
        at: new Date().toISOString(),
      });
      track('choice_select', {
        surface: 'problem',
        context: 'free',
        problemId: problem.id,
        skillId: problem.skills.primary,
        points: problem.points,
        band: problem.band,
        choiceKey: key,
        correct,
        hintLevel: 0,
      });
    },
    [problem],
  );

  // Reveal which answer is correct only once the student has actually found it. Marking it on
  // any selection would tell a student who guessed wrong exactly where to click next, and the
  // hint ladder below would never be opened.
  const answeredCorrectly =
    selected !== null && problem.choices.some((c) => c.key === selected && c.correct);

  return (
    <div>
      <ChoiceList
        choices={problem.choices}
        selected={selected}
        onSelect={onSelect}
        revealAnswer={answeredCorrectly}
        idPrefix={`choice-${problem.id}`}
      />
      <FeedbackPanel problem={problem} selectedKey={selected} />
    </div>
  );
}
