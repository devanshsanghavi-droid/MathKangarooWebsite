import type { Choice, ChoiceKey, Problem } from '@/lib/schemas';

/**
 * The point of the whole project.
 *
 * When a student picks a wrong answer they get the misconception recorded for THAT choice —
 * the specific piece of reasoning that produces that number — not a generic solution and not
 * "incorrect, try again". When they pick the right one they get the reliable method, so a
 * lucky guess still teaches something.
 *
 * The panel is a live region so the result is announced without moving focus, which would
 * otherwise throw a screen reader user out of the choice list.
 */
export function FeedbackPanel({
  problem,
  selectedKey,
}: {
  problem: Pick<Problem, 'choices' | 'solutions' | 'whyOnTest'>;
  selectedKey: ChoiceKey | null;
}) {
  const selected: Choice | undefined = selectedKey
    ? problem.choices.find((choice) => choice.key === selectedKey)
    : undefined;

  if (!selected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sr-only-empty"
        data-testid="feedback-empty"
      />
    );
  }

  if (selected.correct) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="feedback"
        data-outcome="correct"
        className="mt-4 rounded-sm border border-correct bg-correct-bg p-4"
      >
        <p className="m-0 text-sm font-semibold text-ink">
          Correct — {selected.key} is {selected.text}.
        </p>
        <p className="prose-measure mt-3 mb-0 text-sm text-ink-2">{problem.solutions.reliable}</p>
      </div>
    );
  }

  const correct = problem.choices.find((choice) => choice.correct);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="feedback"
      data-outcome="incorrect"
      className="mt-4 rounded-sm border border-incorrect bg-incorrect-bg p-4"
    >
      <p className="m-0 text-sm font-semibold text-ink">
        Not {selected.key}. Here is the thinking that leads there:
      </p>
      {/*
        Quoted and set in the first person because it is written in the student's own voice.
        Reading your own mistake back is what makes it stick.
      */}
      <blockquote className="serif mt-3 mb-0 border-l-2 border-incorrect pl-3 text-ink">
        “{selected.misconception}”
      </blockquote>
      {correct ? (
        <p className="mt-3 mb-0 text-sm text-ink-2">
          Try the hints below before you look at {correct.key}. The nudge gives nothing away.
        </p>
      ) : null}
    </div>
  );
}
