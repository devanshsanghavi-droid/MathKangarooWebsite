import type { ReactNode } from 'react';
import { cx } from './cx';

export interface StatTileProps {
  /** The big number. Rendered in Figtree semibold with tabular figures (docs/06 §1). */
  value: ReactNode;
  label: ReactNode;
  /** A short line under the label: what exactly is counted, or "of 1,000". */
  detail?: ReactNode;
  /** Optional decorative icon in the corner. */
  icon?: ReactNode;
  /** Something under the detail, typically a ProgressBar with hideLabel. */
  footer?: ReactNode;
  className?: string;
}

/**
 * One counter on a card. A number always comes with words saying what it counts. Only the
 * student's own numbers: never a rank, never a comparison with other students.
 */
export function StatTile({ value, label, detail, icon, footer, className }: StatTileProps) {
  return (
    <div className={cx('ui rounded-card border border-rule bg-surface p-4 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-2xs font-semibold tracking-wide text-ink-2 uppercase">{label}</p>
        {icon ? (
          <span aria-hidden="true" className="text-ink-3">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="m-0 mt-1 text-3xl leading-tight font-semibold text-ink tabular-nums">{value}</p>
      {detail ? <p className="m-0 mt-0.5 text-xs text-ink-3">{detail}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
