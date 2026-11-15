import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'outline';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-transparent bg-surface-2 text-ink-2',
  accent: 'border-accent-600 bg-accent-100 text-accent-700',
  outline: 'border-rule-strong bg-transparent text-ink-2',
};

export interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

/** A small static label pill. Not interactive; for a selectable one use ToggleChip. */
export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'ui inline-flex shrink-0 items-center rounded-pill border px-2 py-px text-2xs leading-4 font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The "Beta" pill beside the AMC nav item and AMC headings (docs/06 §2). Teal, never amber:
 * amber is reserved for a hint the student took.
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <Badge tone="accent" className={cx('tracking-wide uppercase', className)}>
      Beta
    </Badge>
  );
}
