import { MASTERY_DISPLAY } from '@/lib/mastery-display';
import type { MasteryState } from '@/lib/mastery';
import { cx } from '@/components/ui';

/**
 * What a single problem's state is CALLED in the bank.
 *
 * The glyphs and fills are the mastery ramp's, but the words are not: on the skill rail ✓
 * means "three in a row across two days", which a single problem cannot be. Reusing "Mastered"
 * here would claim something about a skill from one answer, so a problem says what actually
 * happened to it.
 *
 * Status uses the mastery ramp, never the reserved green/red/amber: a standing total is not
 * feedback on an answer, and docs/05 §2 keeps those three for the moment of answering.
 */
export const PROBLEM_STATUS_LABEL: Record<MasteryState, string> = {
  unseen: 'Not started',
  seen: 'Attempted, not solved',
  shaky: 'Solved after a miss',
  mastered: 'Solved first try',
};

export const STATUS_LEGEND_ORDER: readonly MasteryState[] = ['unseen', 'seen', 'shaky', 'mastered'];

export function StatusGlyph({ state, className }: { state: MasteryState; className?: string }) {
  const display = MASTERY_DISPLAY[state];
  return (
    <span
      aria-hidden="true"
      data-status={state}
      className={cx(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-rule-strong text-2xs leading-none',
        display.fill,
        display.glyph,
        className,
      )}
    >
      {display.icon}
    </span>
  );
}

/** The key to the status column, so the four glyphs never have to be guessed. */
export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Status key"
      className={cx(
        'ui m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs text-ink-2',
        className,
      )}
    >
      {STATUS_LEGEND_ORDER.map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <StatusGlyph state={state} />
          {PROBLEM_STATUS_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}
