'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui';
import { isAnswered, type QuestionState } from './session-state';

/**
 * The bottom bar's "Question 3 of 20" button and the grid it opens (docs/06 §4): one numbered
 * square per question showing answered, marked for review and current.
 *
 * The squares never show right or wrong. Green and red are reserved for the moment of
 * answering (CLAUDE.md), and a navigator that showed them would turn a practice set into a
 * scoreboard. "Answered" is a teal tint, "current" a heavy teal ring plus aria-current, and
 * "marked" a flag glyph, so every state also survives greyscale.
 *
 * A non-modal disclosure, not a dialog: Escape and choosing a square close it and return focus
 * to the button; arrow keys move around the grid.
 */
export function QuestionNavigator({
  questions,
  index,
  onGo,
  onFinish,
}: {
  questions: readonly QuestionState[];
  index: number;
  onGo: (index: number) => void;
  onFinish: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // Opening moves focus to the current square, the way a menu lands on its selected item.
  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>('[aria-current="step"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    const buttons = [...(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    const columns = 5;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = Math.min(buttons.length - 1, at + 1);
    if (event.key === 'ArrowLeft') next = Math.max(0, at - 1);
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, at + columns);
    if (event.key === 'ArrowUp') next = Math.max(0, at - columns);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  }

  const answered = questions.filter(isAnswered).length;
  const marked = questions.filter((q) => q.marked).length;

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="ui inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-rule-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        <span className="tabular-nums">
          Question {index + 1} of {questions.length}
        </span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className={cx(
            'transition-transform motion-reduce:transition-none',
            !open && 'rotate-180',
          )}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        onKeyDown={onKeyDown}
        className="absolute bottom-full left-1/2 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-card border border-rule bg-surface p-3 shadow-lg"
      >
        <p className="ui m-0 mb-2 text-xs text-ink-2">
          {answered} of {questions.length} answered
          {marked > 0 ? `, ${marked} marked for review` : ''}
        </p>
        <div
          ref={grid}
          role="group"
          aria-label="Go to question"
          className="grid grid-cols-5 gap-1.5"
        >
          {questions.map((question, at) => {
            const current = at === index;
            const done = isAnswered(question);
            const parts = [
              `Question ${at + 1}`,
              done ? 'answered' : 'not answered',
              question.marked ? 'marked for review' : null,
            ].filter(Boolean);
            return (
              <button
                key={at}
                type="button"
                aria-current={current ? 'step' : undefined}
                aria-label={parts.join(', ')}
                data-answered={done || undefined}
                data-marked={question.marked || undefined}
                onClick={() => {
                  onGo(at);
                  close();
                }}
                className={cx(
                  'ui relative flex h-11 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold tabular-nums',
                  done
                    ? 'border-accent-600 bg-accent-100 text-accent-700'
                    : 'border-rule-strong bg-surface text-ink-2 hover:bg-surface-2',
                  current && 'ring-2 ring-accent-600 ring-offset-1 ring-offset-surface',
                )}
              >
                {at + 1}
                {question.marked ? (
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1 text-xs text-ink">
                    ⚑
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <ul className="ui m-0 mt-3 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-2xs text-ink-2">
          <li className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-[3px] border border-accent-600 bg-accent-100"
            />
            Answered
          </li>
          <li className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-[3px] border border-rule-strong bg-surface"
            />
            Not answered
          </li>
          <li className="inline-flex items-center gap-1">
            <span aria-hidden="true">⚑</span>
            Marked
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onFinish();
          }}
          className="ui mt-3 min-h-11 w-full cursor-pointer rounded-control border border-rule-strong bg-surface text-sm font-semibold text-ink hover:bg-surface-2"
        >
          Finish set
        </button>
      </div>
    </div>
  );
}
