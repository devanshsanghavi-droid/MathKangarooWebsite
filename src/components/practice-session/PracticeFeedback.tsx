import type { ChoiceKey } from '@/lib/schemas';
import type { PracticeItem } from '@/lib/practice-item';
import { RichText } from '@/components/math/RichText';

/**
 * The practice engine's feedback, with the second try (docs/08 item 11).
 *
 *   nothing checked   an empty live region, ready to speak
 *   right             "Correct - B is 5." and the reliable method (as <FeedbackPanel>)
 *   wrong, 1st check  the misconception for that exact letter and "Try once more."
 *   wrong, 2nd check  the misconception for the second letter; the answer is now marked in the
 *                     choices and the solution is open below
 *
 * One `role="status"` element for every state, so React keeps the same DOM node and the
 * change of content is what a screen reader hears: no second live region, nothing extra
 * announced. The inner box carries `data-testid="feedback"` and `data-outcome` exactly as
 * <FeedbackPanel> does, plus `retry` for the nudge.
 */
export function PracticeFeedback({
  item,
  checkedKey,
  done,
}: {
  item: Pick<PracticeItem, 'choices' | 'solutions' | 'math'>;
  checkedKey: ChoiceKey | null;
  /** Out of tries (or right): the answer is revealed, so the copy stops inviting a retry. */
  done: boolean;
}) {
  const picked = checkedKey ? item.choices.find((choice) => choice.key === checkedKey) : undefined;
  const math = item.math;

  return (
    <div role="status" aria-live="polite" data-testid={picked ? undefined : 'feedback-empty'}>
      {!picked ? null : picked.correct ? (
        <div
          data-testid="feedback"
          data-outcome="correct"
          className="mt-4 rounded-sm border border-correct-border bg-correct-100 p-4"
        >
          <p className="m-0 text-sm font-semibold text-ink">
            Correct - {picked.key} is <RichText text={picked.text} math={math} />.
          </p>
          <p className="prose-measure mt-3 mb-0 text-sm text-ink-2">
            <RichText text={item.solutions.reliable} math={math} />
          </p>
        </div>
      ) : (
        <div
          data-testid="feedback"
          data-outcome={done ? 'incorrect' : 'retry'}
          className="mt-4 rounded-sm border border-wrong-border bg-wrong-100 p-4"
        >
          <p className="m-0 text-sm font-semibold text-ink">
            Not {picked.key}. Here is the thinking that leads there:
          </p>
          <blockquote className="reading mt-3 mb-0 border-l-2 border-wrong-border pl-3 text-ink">
            “<RichText text={picked.misconception ?? ''} math={math} />”
          </blockquote>
          <p className="mt-3 mb-0 text-sm text-ink-2">
            {done ? (
              'The right answer is marked above, and the solution is below.'
            ) : (
              <>
                <span className="font-semibold text-ink">Try once more.</span> A hint below can
                help, and the first one gives nothing away.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
