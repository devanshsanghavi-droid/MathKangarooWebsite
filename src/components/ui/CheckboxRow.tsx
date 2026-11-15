'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

export interface CheckboxRowCount {
  solved: number;
  total: number;
}

export interface CheckboxRowProps {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /**
   * Shown right-aligned. A number ("12") or a solved/total pair ("3 / 12", read as "3 of 12
   * solved"), which is what the question-bank filter shows per skill (docs/06 §4).
   */
  count?: number | CheckboxRowCount;
  /** Mixed state, e.g. a strand header when only some of its skills are ticked. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Something drawn before the label, e.g. a DifficultyPill's dots. Decorative. */
  leading?: ReactNode;
  id?: string;
  name?: string;
  value?: string;
  className?: string;
}

/**
 * One filter row: a native checkbox, its label, and a count. The whole row is the label, so
 * the hit area is the full width, and the native input keeps Space-to-toggle and form
 * semantics for free. `accent-color` tints the tick teal; the browser draws the focus ring.
 */
export function CheckboxRow({
  label,
  checked,
  onCheckedChange,
  count,
  indeterminate = false,
  disabled = false,
  description,
  leading,
  id,
  name,
  value,
  className,
}: CheckboxRowProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const input = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute, so it can only be set from script.
  // The browser then exposes the mixed state itself; no aria-checked is needed on a native input.
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      htmlFor={inputId}
      className={cx(
        'ui flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-xs text-ink',
        'hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        ref={input}
        id={inputId}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-accent-600"
      />
      {leading ? <span aria-hidden="true">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {description ? (
          <span id={descriptionId} className="block text-2xs text-ink-3">
            {description}
          </span>
        ) : null}
      </span>
      {count !== undefined ? <RowCount count={count} /> : null}
    </label>
  );
}

function RowCount({ count }: { count: number | CheckboxRowCount }) {
  if (typeof count === 'number') {
    return <span className="mono shrink-0 text-2xs text-ink-3 tabular-nums">{count}</span>;
  }
  return (
    <span className="mono shrink-0 text-2xs text-ink-3 tabular-nums">
      <span aria-hidden="true">
        {count.solved} / {count.total}
      </span>
      <span className="visually-hidden">
        , {count.solved} of {count.total} solved
      </span>
    </span>
  );
}
