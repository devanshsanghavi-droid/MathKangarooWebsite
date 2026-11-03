import type { MasteryState } from '@/lib/mastery';
import { MASTERY_DISPLAY } from '@/lib/mastery-display';

/**
 * One mastery step, drawn.
 *
 * docs/05-DESIGN-DIRECTION.md §7.5: name + icon + colour, never colour alone. So the dot is a
 * filled circle carrying its glyph, with a --rule-strong outline that gives it a 3:1 boundary
 * against any surface - which is what lets the two palest steps exist at all. The name is
 * always present, either beside the dot or as its accessible name.
 */
export function MasteryDot({
  state,
  showLabel = false,
  size = 'md',
}: {
  state: MasteryState;
  showLabel?: boolean;
  /** `sm` in a dense sidebar row, `md` everywhere else. */
  size?: 'sm' | 'md';
}) {
  const display = MASTERY_DISPLAY[state];
  const box = size === 'sm' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[11px]';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        data-mastery={state}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-rule-strong ${display.fill} ${box} leading-none text-ink`}
      >
        {display.icon}
      </span>
      {showLabel ? (
        <span className="text-xs text-ink-2">{display.label}</span>
      ) : (
        <span className="visually-hidden">{display.label}</span>
      )}
    </span>
  );
}
