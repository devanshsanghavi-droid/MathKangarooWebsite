import type { ChoiceKey } from '@/lib/schemas';

/**
 * Keyboard shortcuts for the practice engine (docs/08 item 11), as a pure function of the key
 * event and the question's state, so every rule is testable without rendering.
 *
 *   A-E, 1-5   pick that choice (the nth choice for a digit), unless the question is done
 *   Enter      Check when a pick is waiting; on a finished question, go on (Next / Finish)
 *
 * Never a shortcut:
 *   - while typing: focus in an input, textarea, select or anything contenteditable
 *   - with Ctrl, Alt, Meta or Shift held, so browser and screen-reader commands stay theirs
 *   - inside a dialog, which owns its own keys
 *   - Enter on a link, a <summary>, or a button other than a choice: Enter already activates
 *     those, and taking it would break them (opening a hint, the navigator, Save)
 *   - Enter on a choice that is not the current pick: the native click picks it, as before
 * So on a choice button: Enter picks it, Enter again checks it.
 */

export type ShortcutAction =
  { type: 'pick'; key: ChoiceKey } | { type: 'check' } | { type: 'continue' };

export interface ShortcutContext {
  /** The question's choice keys, in order. */
  choiceKeys: readonly ChoiceKey[];
  /** Choice buttons' id prefix, e.g. "choice-KA-0001-" (ChoiceList's `${idPrefix}-${key}`). */
  choiceIdPrefix: string;
  selected: ChoiceKey | null;
  canCheck: boolean;
  /** Right, or out of tries. */
  done: boolean;
  /** False for a set of one, where there is nothing to go on to. */
  canContinue: boolean;
}

/** Focus is somewhere a key is text, not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const editable = target.closest('[contenteditable]');
  if (editable && editable.getAttribute('contenteditable') !== 'false') return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

const ACTIVATES_ON_ENTER = 'a[href], button, summary, [role="button"], [role="link"]';

export function shortcutAction(
  event: Pick<
    KeyboardEvent,
    'key' | 'target' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'defaultPrevented'
  >,
  context: ShortcutContext,
): ShortcutAction | null {
  if (event.defaultPrevented) return null;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (isTypingTarget(target)) return null;
  if (target?.closest('[role="dialog"], dialog')) return null;

  const key = event.key;
  if (key === 'Enter') {
    if (event.repeat) return null;
    const control = target?.closest<HTMLElement>(ACTIVATES_ON_ENTER) ?? null;
    if (control) {
      const choiceKey = control.id.startsWith(context.choiceIdPrefix)
        ? control.id.slice(context.choiceIdPrefix.length)
        : null;
      // Not a choice of this question: leave Enter to the control.
      if (choiceKey === null) return null;
      if (context.done) return context.canContinue ? { type: 'continue' } : null;
      // Enter on the waiting pick checks it; on any other choice it picks (natively).
      return context.canCheck && choiceKey === context.selected ? { type: 'check' } : null;
    }
    if (context.canCheck) return { type: 'check' };
    if (context.done && context.canContinue) return { type: 'continue' };
    return null;
  }

  if (context.done || key.length !== 1) return null;
  // A letter names its choice; a digit counts down the list.
  const choice = /^[a-e]$/i.test(key)
    ? context.choiceKeys.find((choiceKey) => choiceKey === key.toUpperCase())
    : /^[1-5]$/.test(key)
      ? context.choiceKeys[Number(key) - 1]
      : undefined;
  return choice ? { type: 'pick', key: choice } : null;
}
