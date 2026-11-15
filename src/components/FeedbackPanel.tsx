import type { Choice, ChoiceKey, Problem } from '@/lib/schemas';
import { RichText } from './math/RichText';

/**
 * The point of the whole project.
 *
 * When a student picks a wrong answer they get the misconception recorded for THAT choice -
 * the specific piece of reasoning that produces that number - not a generic solution and not
 * "incorrect, try again". When they pick the right one they get the reliable method, so a
 * lucky guess still teaches something.
 *
 * The panel is a live region so the result is announced without moving focus, which would
 * otherwise throw a screen reader user out of the choice list.
 */
export function FeedbackPanel({
  problem,
  selectedKey,
  math = false,
}: {
  problem: Pick<Problem, 'choices' | 'solutions'>;
  selectedKey: ChoiceKey | null;
  /** Render `$...$` as math (AMC, under a <MathProvider>). */
  math?: boolean;
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
        className="mt-4 rounded-sm border border-correct-border bg-correct-100 p-4"
      >
        <p className="m-0 text-sm font-semibold text-ink">
          Correct - {selected.key} is <RichText text={selected.text} math={math} />.
        </p>
        <p className="prose-measure mt-3 mb-0 text-sm text-ink-2">
          <RichText text={problem.solutions.reliable} math={math} />
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="feedback"
      data-outcome="incorrect"
      className="mt-4 rounded-sm border border-wrong-border bg-wrong-100 p-4"
    >
      <p className="m-0 text-sm font-semibold text-ink">
        Not {selected.key}. Here is the thinking that leads there:
      </p>
      {/*
        Quoted and set in the first person because it is written in the student's own voice.
        Reading your own mistake back is what makes it stick.
      */}
      <blockquote className="reading mt-3 mb-0 border-l-2 border-wrong-border pl-3 text-ink">
        “<RichText text={selected.misconception ?? ''} math={math} />”
      </blockquote>
      {/*
        Deliberately does not name the correct choice. Handing over the letter here would make
        the hint ladder decorative, and the student would learn the answer rather than the
        method. Pick again when you have used a hint.
      */}
      <p className="mt-3 mb-0 text-sm text-ink-2">
        Take a hint below and try again. The first one gives nothing away.
      </p>
    </div>
  );
}
