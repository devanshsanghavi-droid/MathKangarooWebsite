'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is not plain text (an icon, "1-2"). */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology, e.g. "Level". */
  label: string;
  /** Show `label` above the control. Default false (it is still the accessible name). */
  showLabel?: boolean;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Stretch segments to fill the row. */
  fullWidth?: boolean;
  /**
   * Let segments wrap onto a second row instead of scrolling sideways. For a narrow column
   * (the bank's 300px filter panel) where a scrolled-off segment would simply go unseen.
   */
  wrap?: boolean;
  className?: string;
}

/**
 * A single-choice row of segments (the bank's level picker, the AMC 10 / 12 switch).
 *
 * The WAI-ARIA radio-group pattern: one tab stop (the selected segment), arrow keys move AND
 * select, Home / End jump to the ends. The selected segment is a solid teal fill with
 * --on-accent text plus `aria-checked`, so the state is never carried by colour alone.
 */
export function SegmentedControl<T extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  wrap = false,
  className,
}: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = selectedIndex === last ? 0 : selectedIndex + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = selectedIndex === 0 ? last : selectedIndex - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div className={cx('ui', fullWidth && 'w-full', className)}>
      {showLabel ? (
        <span aria-hidden="true" className="mb-1.5 block text-2xs font-semibold text-ink-2">
          {label}
        </span>
      ) : null}
      <div
        ref={group}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cx(
          'flex gap-0.5 rounded-control border border-rule-strong bg-surface-2 p-0.5',
          wrap
            ? 'w-full flex-wrap'
            : fullWidth
              ? 'w-full'
              : 'inline-flex max-w-full overflow-x-auto',
        )}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.ariaLabel}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              className={cx(
                'cursor-pointer rounded-[6px] font-semibold whitespace-nowrap tabular-nums',
                'transition-colors motion-reduce:transition-none',
                size === 'sm' ? 'min-h-8 px-2.5 text-2xs' : 'min-h-9 px-3 text-xs',
                (fullWidth || wrap) && 'flex-1',
                selected
                  ? 'bg-accent-600 text-on-accent shadow-xs'
                  : 'text-ink-2 hover:bg-surface hover:text-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
