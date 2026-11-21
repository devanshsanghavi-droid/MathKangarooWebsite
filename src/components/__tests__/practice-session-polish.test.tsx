import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PracticeSession } from '../practice-session';
import { MathProvider } from '../math/MathProvider';
import {
  initialSession,
  isDone,
  onSecondTry,
  sessionReducer,
  summarize,
  OUTCOME_LABEL,
} from '../practice-session/session-state';
import {
  isTypingTarget,
  shortcutAction,
  type ShortcutContext,
} from '../practice-session/shortcuts';
import { getAllProblems, getSkill } from '@/lib/content';
import { kaPracticeItem, type KaPracticeItem, type PracticeItem } from '@/lib/practice-item';
import { isSaved, readProgress, savedIds, toggleSaved } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { statusOfProblem } from '@/lib/progress-summary';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const items: KaPracticeItem[] = getAllProblems()
  .slice(0, 3)
  .map((problem) => kaPracticeItem(problem, (id) => getSkill(id)?.name));
const first = items[0] as KaPracticeItem;

const right = (item: PracticeItem) => item.choices.find((c) => c.correct)?.key ?? 'A';
const wrongs = (item: PracticeItem) => item.choices.filter((c) => !c.correct);

function choiceButton(key: string) {
  const group = screen.getByRole('group', { name: /answer choices/i });
  const button = within(group)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().startsWith(key));
  if (!button) throw new Error(`no choice ${key}`);
  return button;
}

const checkButton = () => screen.getByRole('button', { name: 'Check' });

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
});

/* -------------------------------------------------------------------------- */
/* Save (docs/08 item 10)                                                      */
/* -------------------------------------------------------------------------- */

describe('the Save button', () => {
  it('toggles the question in the saved list, with aria-pressed and the label', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await user.click(save);
    const saved = screen.getByRole('button', { name: 'Saved' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    expect(isSaved(first.id)).toBe(true);
    await user.click(saved);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false');
    expect(savedIds()).toEqual([]);
  });

  it('follows the question shown: each question has its own state', async () => {
    const user = userEvent.setup();
    toggleSaved(items[1]?.id ?? '');
    render(<PracticeSession items={items} title="Set" />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is on a problem page (a set of one) too', () => {
    render(<PracticeSession items={[first]} title="x" mode="single" headingLevel={1} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('works for AMC, SAT and ACT ids', async () => {
    const user = userEvent.setup();
    for (const id of ['AM-9001', 'SA-0001', 'AC-0001']) {
      const item = { ...first, id, href: `/x/${id}` } as PracticeItem;
      const { unmount } = render(
        <MathProvider>
          <PracticeSession items={[item]} title="x" mode="single" />
        </MathProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(isSaved(id)).toBe(true);
      unmount();
    }
    expect(savedIds()).toEqual(['AM-9001', 'SA-0001', 'AC-0001']);
  });
});

/* -------------------------------------------------------------------------- */
/* Second try (docs/08 item 11)                                                */
/* -------------------------------------------------------------------------- */

describe('the second try', () => {
  it('nudges with the misconception, then reveals after the second wrong pick', async () => {
    const user = userEvent.setup();
    const [w1, w2] = wrongs(first);
    if (!w1 || !w2) throw new Error('need two wrong choices');
    render(<PracticeSession items={items} title="Set" />);

    await user.click(choiceButton(w1.key));
    await user.click(checkButton());
    const nudge = screen.getByTestId('feedback');
    expect(nudge).toHaveAttribute('data-outcome', 'retry');
    expect(nudge.textContent).toContain(w1.misconception ?? '');
    expect(nudge.textContent).toContain('Try once more.');
    // Not revealed yet: no solution and no "correct" mark on the choices.
    expect(screen.queryByText('Solution')).toBeNull();
    expect(choiceButton(right(first)).textContent).not.toMatch(/correct/);
    // Hints stay available.
    expect(screen.getByText('A nudge')).toBeInTheDocument();
    // The same letter cannot be checked again.
    expect(checkButton()).toBeDisabled();

    await user.click(choiceButton(w2.key));
    await user.click(checkButton());
    const final = screen.getByTestId('feedback');
    expect(final).toHaveAttribute('data-outcome', 'incorrect');
    expect(final.textContent).toContain(w2.misconception ?? '');
    expect(final.textContent).not.toContain('Try once more.');
    expect(screen.getByText('Solution')).toBeInTheDocument();
    expect(choiceButton(right(first)).textContent).toMatch(/correct/);

    // Out of tries: the choices are locked and Check stays off.
    await user.click(choiceButton(right(first)));
    expect(choiceButton(right(first))).toHaveAttribute('aria-pressed', 'false');
    expect(checkButton()).toBeDisabled();
  });

  it('records the first pick only, once, whatever the second try does', async () => {
    const user = userEvent.setup();
    const [w1] = wrongs(first);
    if (!w1) throw new Error('need a wrong choice');
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(w1.key));
    await user.click(checkButton());
    await user.click(choiceButton(right(first)));
    await user.click(checkButton());
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
    expect(screen.getByText('Solution')).toBeInTheDocument();
    const attempts = readProgress().attempts[first.skillIds[0] ?? ''] ?? [];
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.correct).toBe(false);
    expect(statusOfProblem(readProgress(), first.id, first.skillIds)).toBe('seen');
  });

  it('labels a right second try on the end screen, and still counts it as missed', async () => {
    const user = userEvent.setup();
    const [w1] = wrongs(first);
    if (!w1) throw new Error('need a wrong choice');
    render(<PracticeSession items={[first]} title="Set" />);
    await user.click(choiceButton(w1.key));
    await user.click(checkButton());
    await user.click(choiceButton(right(first)));
    await user.click(checkButton());
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText(OUTCOME_LABEL['after-miss'])).toBeInTheDocument();
    expect(OUTCOME_LABEL['after-miss']).toBe('Right on the second try');
    expect(screen.getByRole('link', { name: 'Review missed (1)' })).toBeInTheDocument();
  });

  it('follows the rules in the reducer', () => {
    let state = initialSession(1);
    state = sessionReducer(state, { type: 'pick', key: 'A' });
    state = sessionReducer(state, { type: 'check', correct: false });
    const firstTry = state.questions[0];
    expect(firstTry && onSecondTry(firstTry)).toBe(true);
    // Re-checking the same letter does not spend the second try.
    state = sessionReducer(state, { type: 'check', correct: false });
    expect(state.questions[0]?.tries).toBe(1);
    state = sessionReducer(state, { type: 'pick', key: 'B' });
    state = sessionReducer(state, { type: 'check', correct: false });
    const q = state.questions[0];
    expect(q?.tries).toBe(2);
    expect(q && isDone(q)).toBe(true);
    // Done: picks and checks are ignored.
    state = sessionReducer(state, { type: 'pick', key: 'C' });
    state = sessionReducer(state, { type: 'check', correct: true });
    expect(state.questions[0]?.selected).toBe('B');
    expect(state.questions[0]?.solved).toBe(false);
    expect(summarize([first], state).correct).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Keyboard shortcuts (docs/08 item 11)                                        */
/* -------------------------------------------------------------------------- */

describe('keyboard shortcuts', () => {
  it('shows a standing hint that is not a live region', () => {
    render(<PracticeSession items={items} title="Set" />);
    const hint = screen.getByText('Keyboard: A-E to choose, Enter to check');
    expect(hint).toBeVisible();
    expect(hint.closest('[aria-live]')).toBeNull();
  });

  it('names A-D for a four-choice question and ignores E and 5', async () => {
    const user = userEvent.setup();
    const four = { ...first, choices: first.choices.slice(0, 4) } as PracticeItem;
    render(<PracticeSession items={[four]} title="Set" mode="single" />);
    expect(screen.getByText('Keyboard: A-D to choose, Enter to check')).toBeInTheDocument();
    await user.keyboard('e5');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await user.keyboard('4');
    expect(choiceButton('D')).toHaveAttribute('aria-pressed', 'true');
  });

  it('picks with a letter or a digit and checks with Enter', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    await user.keyboard('c');
    expect(choiceButton('C')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('2');
    expect(choiceButton('B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('feedback')).toBeNull();
    await user.keyboard(right(first).toLowerCase());
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });

  it('goes on to the next question with Enter once the question is done', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    await user.keyboard(right(first).toLowerCase());
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: /Question 2/ })).toHaveFocus();
  });

  it('on a choice button, Enter picks it and Enter again checks it', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    const choice = choiceButton(right(first));
    choice.focus();
    await user.keyboard('{Enter}');
    expect(choice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('feedback')).toBeNull();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });

  it('leaves Enter to other buttons (Save is toggled, not checked)', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    await user.keyboard('a');
    screen.getByRole('button', { name: 'Save' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('ignores keys with a modifier held, and while typing in a field', () => {
    render(
      <>
        <input aria-label="Notes" />
        <PracticeSession items={items} title="Set" />
      </>,
    );
    act(() => {
      fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(document.body, { key: 'a', metaKey: true });
      fireEvent.keyDown(document.body, { key: 'a', altKey: true });
      fireEvent.keyDown(document.body, { key: 'A', shiftKey: true });
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Notes' }), { key: 'a' });
    });
    expect(choiceButton('A')).toHaveAttribute('aria-pressed', 'false');
    act(() => {
      fireEvent.keyDown(document.body, { key: 'a' });
    });
    expect(choiceButton('A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not pick after the question is done', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" mode="single" />);
    await user.keyboard(right(first).toLowerCase());
    await user.keyboard('{Enter}');
    const other = wrongs(first)[0]?.key ?? 'A';
    await user.keyboard(other.toLowerCase());
    expect(choiceButton(other)).toHaveAttribute('aria-pressed', 'false');
    // A set of one has nothing to go on to: Enter does nothing more.
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });

  it('does nothing on the end screen', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={[first]} title="Set" />);
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.keyboard('a{Enter}');
    expect(screen.getByRole('heading', { name: 'Set complete' })).toBeInTheDocument();
  });
});

describe('shortcutAction', () => {
  const context: ShortcutContext = {
    choiceKeys: ['A', 'B', 'C', 'D', 'E'],
    choiceIdPrefix: 'choice-KA-0001-',
    selected: null,
    canCheck: false,
    done: false,
    canContinue: true,
  };
  const event = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
    key,
    target: document.body,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    ...extra,
  });

  it('maps A-E and 1-5 to choices and ignores other keys', () => {
    expect(shortcutAction(event('e'), context)).toEqual({ type: 'pick', key: 'E' });
    expect(shortcutAction(event('1'), context)).toEqual({ type: 'pick', key: 'A' });
    expect(shortcutAction(event('f'), context)).toBeNull();
    expect(shortcutAction(event('6'), context)).toBeNull();
    expect(shortcutAction(event('ArrowDown'), context)).toBeNull();
  });

  it('checks, continues, or does nothing on Enter', () => {
    expect(shortcutAction(event('Enter'), context)).toBeNull();
    expect(shortcutAction(event('Enter'), { ...context, selected: 'B', canCheck: true })).toEqual({
      type: 'check',
    });
    expect(shortcutAction(event('Enter'), { ...context, done: true })).toEqual({
      type: 'continue',
    });
    expect(shortcutAction(event('Enter'), { ...context, done: true, canContinue: false })).toBe(
      null,
    );
    expect(
      shortcutAction(event('Enter', { repeat: true }), { ...context, canCheck: true }),
    ).toBeNull();
  });

  it('stays out of typing targets, dialogs and modifier chords', () => {
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.append(inner);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const inDialog = document.createElement('span');
    dialog.append(inDialog);
    document.body.append(textarea, select, editable, dialog);
    for (const target of [textarea, select, inner]) {
      expect(isTypingTarget(target)).toBe(true);
      expect(shortcutAction(event('a', { target }), context)).toBeNull();
    }
    expect(shortcutAction(event('a', { target: inDialog }), context)).toBeNull();
    expect(shortcutAction(event('a', { ctrlKey: true }), context)).toBeNull();
    expect(shortcutAction(event('a', { defaultPrevented: true }), context)).toBeNull();
    expect(isTypingTarget(document.body)).toBe(false);
    document.body.replaceChildren();
  });
});
