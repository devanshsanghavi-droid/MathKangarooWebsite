'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui';
import { examById, examColorVar } from '@/lib/exams';
import type { ExamFilter as Filter } from '@/lib/progress-analytics';

export interface ExamFilterOption {
  value: Filter;
  answers: number;
  tests: number;
}

/**
 * All exams or one (docs/08 item 8). The WAI-ARIA radio-group pattern, like SegmentedControl,
 * plus disabled options: an exam with nothing in it stays visible, so the student knows it is
 * there, but is aria-disabled and skipped by the arrow keys. The choice is shown by a solid
 * fill AND aria-checked AND a tick, never colour alone; the coloured dot only names the exam.
 */
export function ExamFilter({
  options,
  value,
  onChange,
}: {
  options: readonly ExamFilterOption[];
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const enabled = options.flatMap((o, i) => (o.answers + o.tests > 0 ? [i] : []));
  const selectedIndex = options.findIndex((o) => o.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = enabled.indexOf(selectedIndex);
    const last = enabled.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = at >= last ? 0 : at + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = at <= 0 ? last : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    const index = enabled[next];
    const option = index === undefined ? undefined : options[index];
    if (!option || index === undefined) return;
    onChange(option.value);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Exam"
      onKeyDown={onKeyDown}
      className="ui flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const exam = option.value === 'all' ? undefined : examById(option.value);
        const selected = option.value === value;
        const disabled = option.answers + option.tests === 0;
        const label = exam ? exam.shortName : 'All exams';
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!disabled) onChange(option.value);
            }}
            className={cx(
              'inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3 text-sm whitespace-nowrap',
              'transition-colors motion-reduce:transition-none',
              selected
                ? 'cursor-pointer border-accent-600 bg-accent-600 font-semibold text-on-accent'
                : disabled
                  ? 'cursor-not-allowed border-rule bg-surface-2 text-ink-3'
                  : 'cursor-pointer border-rule-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {selected ? <span aria-hidden="true">✓</span> : null}
            {exam && !selected && !disabled ? (
              <span
                aria-hidden="true"
                className="inline-block size-2.5 rounded-full"
                style={{ background: examColorVar(exam) }}
              />
            ) : null}
            {label}
            {disabled ? (
              <span className="text-2xs">
                <span aria-hidden="true">(none yet)</span>
                <span className="visually-hidden">, nothing answered yet</span>
              </span>
            ) : (
              <span
                className={cx(
                  'mono text-2xs tabular-nums',
                  selected ? 'text-on-accent' : 'text-ink-3',
                )}
              >
                {option.answers}
                <span className="visually-hidden"> answered</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
