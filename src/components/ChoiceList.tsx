'use client';

import { useRef } from 'react';
import type { Choice, ChoiceKey } from '@/lib/schemas';

/**
 * The five answer choices.
 *
 * Controlled: the parent owns which key is selected, because <FeedbackPanel> needs the same
 * value and two components reading one piece of state beats two copies of it.
 *
 * Keyboard: these are ordinary buttons, so every one is a tab stop and Enter/Space activate
 * them. Arrow keys, Home and End move between them as well — an addition, not a replacement,
 * because a five-item group is small enough that a roving tabindex would take away more than
 * it gives.
 *
 * `aria-pressed` rather than radio semantics: a choice can be selected and then changed, and
 * the correctness of a selection is announced by the feedback panel's live region, not by the
 * button's own name.
 */
export function ChoiceList({
  choices,
  selected,
  onSelect,
  revealed = false,
  idPrefix = 'choice',
}: {
  choices: readonly Choice[];
  selected: ChoiceKey | null;
  onSelect: (key: ChoiceKey) => void;
  /** After a selection, mark the correct answer so a student is never left guessing. */
  revealed?: boolean;
  idPrefix?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = [...(listRef.current?.querySelectorAll('button') ?? [])];
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    event.preventDefault();

    let next = current;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
      next = (current + 1) % buttons.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
      next = (current - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[next]?.focus();
  }

  return (
    /*
      The group carries the label and the arrow-key handling; the list inside carries the list
      semantics. Putting role="group" on the <ul> itself would override its implicit list role
      and orphan every <li> — axe catches exactly that, and it did.
    */
    <div ref={listRef} role="group" aria-label="Answer choices" onKeyDown={handleKeyDown}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {choices.map((choice) => {
          const isSelected = selected === choice.key;
          const showAsCorrect = revealed && choice.correct;
          const showAsWrong = revealed && isSelected && !choice.correct;

          return (
            <li key={choice.key}>
              <button
                type="button"
                id={`${idPrefix}-${choice.key}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(choice.key)}
                className={[
                  'flex w-full cursor-pointer items-baseline gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors',
                  showAsCorrect
                    ? 'border-correct bg-correct-bg text-ink'
                    : showAsWrong
                      ? 'border-incorrect bg-incorrect-bg text-ink'
                      : isSelected
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-rule bg-surface text-ink hover:border-rule-2',
                ].join(' ')}
              >
                <span className="mono shrink-0 text-sm font-semibold text-ink-3">{choice.key}</span>
                <span className="serif flex-1">{choice.text}</span>
                {/* The outcome is spelled out in words as well as in colour. */}
                {showAsCorrect ? (
                  <span className="mono shrink-0 text-2xs font-medium text-correct">correct</span>
                ) : null}
                {showAsWrong ? (
                  <span className="mono shrink-0 text-2xs font-medium text-incorrect">
                    your answer
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
