import { useId, type ReactNode } from 'react';
import { percentOf, progressValueText } from './progress-math';
import { cx } from './cx';

export interface ProgressRingProps {
  value: number;
  max: number;
  /** Accessible name, e.g. "Algebra". Rendered visibly under the ring unless hideLabel. */
  label: ReactNode;
  hideLabel?: boolean;
  /** Diameter in px. Default 64. */
  size?: number;
  /** Ring thickness in px. Default 6. */
  thickness?: number;
  /** Centre content. Default the whole-number percentage. */
  children?: ReactNode;
  unit?: string;
  className?: string;
}

/**
 * A completion ring per area (docs/06 §1). An SVG arc in --accent-600 over a --track circle,
 * exposed as a progressbar with "3 of 12 solved" so the arc is never the only carrier. The
 * percentage (or whatever `children` says) is printed in the middle.
 */
export function ProgressRing({
  value,
  max,
  label,
  hideLabel = false,
  size = 64,
  thickness = 6,
  children,
  unit = 'solved',
  className,
}: ProgressRingProps) {
  const labelId = useId();
  const percent = percentOf(value, max);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <div className={cx('ui inline-flex flex-col items-center gap-1.5', className)}>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, max)}
        aria-valuenow={Math.min(Math.max(0, value), Math.max(0, max))}
        aria-valuetext={progressValueText(value, max, unit)}
        className="relative"
        style={{ width: size, height: size }}
      >
        <svg
          aria-hidden="true"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-track"
          />
          {percent > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className="stroke-accent-600"
            />
          ) : null}
        </svg>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink tabular-nums"
        >
          {children ?? `${Math.round(percent)}%`}
        </span>
      </div>
      <span
        id={labelId}
        className={hideLabel ? 'visually-hidden' : 'text-2xs font-medium text-ink-2'}
      >
        {label}
      </span>
    </div>
  );
}
