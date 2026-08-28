'use client';

import { useState } from 'react';
import type { ChoiceKey, Problem } from '@/lib/schemas';
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
 */
export function ProblemInteractive({ problem }: { problem: Problem }) {
  const [selected, setSelected] = useState<ChoiceKey | null>(null);

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
        onSelect={setSelected}
        revealAnswer={answeredCorrectly}
        idPrefix={`choice-${problem.id}`}
      />
      <FeedbackPanel problem={problem} selectedKey={selected} />
    </div>
  );
}
