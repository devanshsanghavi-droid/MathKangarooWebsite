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
  revealAnswer = false,
  idPrefix = 'choice',
}: {
  choices: readonly Choice[];
  selected: ChoiceKey | null;
  onSelect: (key: ChoiceKey) => void;
  /**
   * Mark which choice is correct. Deliberately NOT implied by making a selection: telling a
   * student the right letter the moment they get it wrong makes the hint ladder pointless.
   * The parent turns this on when the student answers correctly, or when they open the full
   * solution.
   */
  revealAnswer?: boolean;
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
          const showAsCorrect = revealAnswer && choice.correct;
          const showAsWrong = isSelected && !choice.correct;

          return (
            <li key={choice.key}>
              <button
                type="button"
                id={`${idPrefix}-${choice.key}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(choice.key)}
                /*
                  docs/05 §6: 2px border, 14px padding, at least 44px tall. The resting border
                  is --rule-strong rather than --rule because --surface on --ground is 1.06:1 —
                  the border is the only thing identifying this as a control, so WCAG 1.4.11
                  applies to it and it has to clear 3:1.
                */
                className={[
                  'tap-target flex w-full cursor-pointer items-center gap-3 rounded-md border-2 p-[14px] text-left transition-colors',
                  showAsCorrect
                    ? 'border-correct-border bg-correct-100 text-ink'
                    : showAsWrong
                      ? 'border-wrong-border bg-wrong-100 text-ink'
                      : isSelected
                        ? 'border-accent-600 bg-accent-100 text-ink'
                        : 'border-rule-strong bg-surface text-ink hover:border-accent-600',
                ].join(' ')}
              >
                <span className="mono shrink-0 text-sm font-semibold text-ink-2">{choice.key}</span>
                <span className="reading flex-1 text-base">{choice.text}</span>
                {/* The outcome is spelled out in words as well as in colour. */}
                {showAsCorrect ? (
                  <span className="mono shrink-0 text-2xs font-medium text-correct-700">
                    correct
                  </span>
                ) : null}
                {showAsWrong ? (
                  <span className="mono shrink-0 text-2xs font-medium text-wrong-700">
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
