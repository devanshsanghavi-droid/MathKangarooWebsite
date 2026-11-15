import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import { percentOf, progressValueText } from './progress-math';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** What is being measured, e.g. "Geometry" or "This selection". Always the accessible name. */
  label: ReactNode;
  /** Hide the visible label row (the bar is still named). Use when a heading beside it says it. */
  hideLabel?: boolean;
  /** Word after the numbers: "3 of 12 solved". Default "solved". */
  unit?: string;
  /** Override the visible numbers on the right. Default "3 / 12". */
  numbers?: ReactNode;
  /** `sm` is the 6px bar (docs/06 §1); `md` is 8px for a page-level summary. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The main "gamified" element in v3 (docs/06 §1): a thin rounded teal bar with its numbers.
 *
 * The numbers are always printed beside it, and the bar is role="progressbar" with
 * aria-valuetext "3 of 12 solved", so the fill is never the only carrier. No points, no XP:
 * it counts problems, and only the student's own.
 */
export function ProgressBar({
  value,
  max,
  label,
  hideLabel = false,
  unit = 'solved',
  numbers,
  size = 'sm',
  className,
}: ProgressBarProps) {
  const labelId = useId();
  const percent = percentOf(value, max);

  return (
    <div className={cx('ui min-w-0', className)}>
      {hideLabel ? (
        <span id={labelId} className="visually-hidden">
          {label}
        </span>
      ) : (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span id={labelId} className="min-w-0 truncate font-medium text-ink">
            {label}
          </span>
          <span aria-hidden="true" className="mono shrink-0 text-2xs text-ink-2 tabular-nums">
            {numbers ?? (
              <>
                {value} / {max}
              </>
            )}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, max)}
        aria-valuenow={Math.min(Math.max(0, value), Math.max(0, max))}
        aria-valuetext={progressValueText(value, max, unit)}
        className={cx(
          'overflow-hidden rounded-pill bg-track print:border print:border-rule',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <div
          className="h-full rounded-pill bg-accent-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
