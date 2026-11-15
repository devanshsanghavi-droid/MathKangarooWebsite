import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from './cx';

export interface ChipProps {
  /** `selected` uses the accent; default is neutral. */
  selected?: boolean;
  className?: string;
  children: ReactNode;
}

/** A static pill: a tag, a filter summary, a skill name. Full pill radius (docs/06 §1). */
export function Chip({ selected = false, className, children }: ChipProps) {
  return (
    <span
      className={cx(
        'ui inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium',
        selected
          ? 'border-accent-600 bg-accent-100 text-accent-700'
          : 'border-rule bg-surface text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface ToggleChipProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'onChange' | 'aria-pressed'
> {
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /** Optional count shown after the label, e.g. problems matching this chip. */
  count?: number;
  children: ReactNode;
}

/**
 * A filter chip that toggles: a <button aria-pressed>. The pressed state is carried by
 * aria-pressed, a tick glyph and the accent fill, so it is never colour alone. Controlled:
 * the parent owns `pressed`. A button, not a link, so crawlers find no filter URLs (docs/06 §3).
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  count,
  className,
  children,
  onClick,
  ...rest
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPressedChange?.(!pressed);
      }}
      className={cx(
        'ui inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill border px-3 text-xs font-medium',
        'transition-colors motion-reduce:transition-none',
        pressed
          ? 'border-accent-600 bg-accent-100 text-accent-700'
          : 'border-rule-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className={cx('w-3 text-center', !pressed && 'hidden')}>
        ✓
      </span>
      {children}
      {count !== undefined ? (
        <span className="mono text-2xs text-ink-3 tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}
