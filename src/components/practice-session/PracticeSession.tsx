'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ChoiceList } from '@/components/ChoiceList';
import { HintLadder, type HintRevealDetail } from '@/components/HintLadder';
import { SolutionTabs } from '@/components/SolutionTabs';
import { FigureRenderer } from '@/components/FigureRenderer';
import { DifficultyPill } from '@/components/DifficultyPill';
import { RichText } from '@/components/math/RichText';
import { Badge, Button, Card, cx } from '@/components/ui';
import type { ChoiceKey } from '@/lib/schemas';
import type { PracticeItem } from '@/lib/practice-item';
import type { Surface } from '@/lib/telemetry/events';
import { recordPracticeAttempt } from '@/lib/practice-record';
import { QuestionNavigator } from './QuestionNavigator';
import { SessionSummary } from './SessionSummary';
import { PracticeFeedback } from './PracticeFeedback';
import { SaveButton } from './SaveButton';
import { shortcutAction } from './shortcuts';
import {
  formatClock,
  initialSession,
  isDone,
  sessionReducer,
  spokenDuration,
  summarize,
  type SessionSummary as Summary,
} from './session-state';

export interface PracticeSessionProps {
  /** The questions, in order. Kangaroo and AMC items may not be mixed in one set. */
  items: PracticeItem[];
  /** The set's name in the top bar ("Practice set", "Review missed"). */
  title: string;
  /**
   * `set` is the test-like runner: question x of n, navigator, mark for review, end screen.
   * `single` is a set of one for a problem's own page: no navigator and no end screen.
   */
  mode?: 'set' | 'single';
  /** Heading level of the question heading. 1 on a problem page, where the question is the page. */
  headingLevel?: 1 | 2;
  /** Appended to the question heading, e.g. the primary skill's name on /problem/[id]. */
  headingSuffix?: string;
  /** Where "Back to the bank" goes from the end screen. */
  exitHref?: string;
  exitLabel?: string;
  /** Telemetry surface for the attempt events. */
  surface?: Surface;
  /** Ids the loader asked for but could not find; reported on the end screen. */
  missing?: readonly string[];
  /** Called once when the end screen opens. */
  onFinish?: (summary: Summary) => void;
}

/**
 * The practice engine (docs/06 §4). One component for /practice/set, /problem/[id] (a set of
 * one), the AMC bank and the AMC problem page.
 *
 * Answering is pick, then Check. The first Check is the attempt: it is scored for the set and
 * recorded through `saveAttempt` / `saveAmcAttempt` exactly as the problem page always has,
 * with the same telemetry event, and nothing after it is. Feedback is the existing reserved
 * trio: <ChoiceList> marks the judged pick, <PracticeFeedback> gives the misconception for that
 * exact wrong letter, <HintLadder> draws a taken hint in amber. This file adds no colour of its
 * own beyond the teal accent and neutrals.
 *
 * docs/08: a Save toggle on every question (item 10); keyboard shortcuts A-E / 1-5 to pick and
 * Enter to check or go on (item 11, rules in shortcuts.ts); and one second try after a wrong
 * first check, with the misconception as the nudge, before the answer and solution show.
 *
 * Everything the server needs for a no-JS reader and a crawler renders on the first pass: the
 * statement, the figure and the five choices. The timer starts in an effect, so the server and
 * the first client render agree on 0:00.
 */
export function PracticeSession({
  items,
  title,
  mode = 'set',
  headingLevel = 2,
  headingSuffix,
  exitHref = '/problems',
  exitLabel = 'Back to the bank',
  surface = mode === 'single' ? 'problem' : 'practice-set',
  missing = [],
  onFinish,
}: PracticeSessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, items.length, initialSession);
  const [timerHidden, setTimerHidden] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // docs/08 item 9: when each question first came on screen and when it was first picked,
  // by index, so the recorded attempt carries the time from seeing it to the first pick.
  const shownAt = useRef(new Map<number, number>());
  const pickedAt = useRef(new Map<number, number>());

  const item = items[state.index];
  const question = state.questions[state.index];
  const single = mode === 'single';
  const bank = items[0]?.bank ?? 'ka';

  // Count-up timer. Started after mount so server HTML and hydration both say 0:00.
  useEffect(() => {
    startedAt.current ??= Date.now();
    // Stops on the end screen; the time shown there is the time at Finish.
    if (state.finished) return;
    const tick = () =>
      setSeconds(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state.finished]);

  // Stamp the first time each question is shown (after mount, so the server never runs it).
  useEffect(() => {
    if (state.finished || shownAt.current.has(state.index)) return;
    shownAt.current.set(state.index, Date.now());
  }, [state.index, state.finished]);

  // After moving to another question (not on first render), put focus on its heading so a
  // screen reader announces where it landed, and bring the question into view.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const target = state.finished
      ? rootRef.current?.querySelector<HTMLElement>('#session-summary')
      : headingRef.current;
    target?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView?.({ block: 'start' });
  }, [state.index, state.finished]);

  const go = useCallback((index: number) => {
    moved.current = true;
    dispatch({ type: 'go', index });
  }, []);

  const finish = useCallback(() => {
    moved.current = true;
    dispatch({ type: 'finish' });
  }, []);

  const finishedOnce = useRef(false);
  useEffect(() => {
    if (!state.finished || finishedOnce.current) return;
    finishedOnce.current = true;
    onFinish?.(summarize(items, state));
  }, [items, onFinish, state]);

  // docs/08 item 11: keyboard shortcuts. One listener on the document; the latest handler is
  // kept in a ref so the listener never goes stale and is never re-added per render.
  const onShortcut = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut.current(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  // Off unless a question is on screen; set again below once it is.
  onShortcut.current = () => {};

  if (!item || !question) {
    return (
      <Card>
        <p className="m-0 text-ink-2">This set has no questions in it.</p>
      </Card>
    );
  }

  if (state.finished && !single) {
    return (
      <div ref={rootRef} className="scroll-mt-20">
        <SessionSummary
          bank={bank}
          items={items}
          state={state}
          summary={summarize(items, state)}
          seconds={seconds}
          exitHref={exitHref}
          exitLabel={exitLabel}
          missing={missing}
          onResume={(index) => {
            moved.current = true;
            dispatch({ type: 'resume', ...(index === undefined ? {} : { index }) });
          }}
        />
      </div>
    );
  }

  const done = isDone(question);
  const pendingPick = !done && question.selected !== null && question.selected !== question.checked;
  const canCheck = pendingPick;
  const last = state.index === items.length - 1;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  // "A-E" for five choices, "A-D" for the four of an SAT or ACT question.
  const lastKey = item.choices[item.choices.length - 1]?.key ?? 'E';
  const headingId = `question-${item.id}`;

  function check() {
    if (!item || !question || question.selected === null) return;
    const key: ChoiceKey = question.selected;
    const correct = item.choices.some((choice) => choice.key === key && choice.correct);
    if (question.firstCorrect === null) {
      const now = Date.now();
      const shown = shownAt.current.get(state.index) ?? now;
      const picked = pickedAt.current.get(state.index) ?? now;
      recordPracticeAttempt(item, {
        choiceKey: key,
        correct,
        hintsUsed: question.hints,
        surface,
        ms: Math.max(0, picked - shown),
        mode: 'practice',
      });
    }
    dispatch({ type: 'check', correct });
  }

  function pick(key: ChoiceKey) {
    if (!question || isDone(question)) return;
    if (!pickedAt.current.has(state.index)) pickedAt.current.set(state.index, Date.now());
    dispatch({ type: 'pick', key });
  }

  onShortcut.current = (event: KeyboardEvent) => {
    const action = shortcutAction(event, {
      choiceKeys: item.choices.map((choice) => choice.key),
      choiceIdPrefix: `choice-${item.id}-`,
      selected: question.selected,
      canCheck,
      done,
      canContinue: !single,
    });
    if (!action) return;
    event.preventDefault();
    if (action.type === 'pick') pick(action.key);
    else if (action.type === 'check') check();
    else if (last) finish();
    else go(state.index + 1);
  };

  return (
    <div ref={rootRef} className="scroll-mt-20">
      {/* ------------------------------------------------------------ top bar */}
      <div className="ui mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {single ? null : (
          <>
            {/* A row of its own on a phone, where sharing one with the counter and the timer
                squeezed "Practice set" down to "Practi...". */}
            <p className="m-0 min-w-0 basis-full truncate text-sm font-semibold text-ink sm:flex-1 sm:basis-auto">
              {title}
            </p>
            <p className="m-0 text-sm text-ink-2 tabular-nums" aria-live="polite">
              Question {state.index + 1} of {items.length}
            </p>
          </>
        )}
        <div className={cx('flex items-center gap-2', single && 'ml-auto')}>
          {timerHidden ? null : (
            <span className="mono text-sm text-ink-2 tabular-nums" role="timer" aria-live="off">
              <span aria-hidden="true">{formatClock(seconds)}</span>
              <span className="visually-hidden">Time {spokenDuration(seconds)}</span>
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setTimerHidden((value) => !value)}>
            {timerHidden ? 'Show timer' : 'Hide timer'}
          </Button>
        </div>
        <SaveButton problemId={item.id} />
        {single ? null : (
          <Button
            size="sm"
            variant={question.marked ? 'primary' : 'secondary'}
            aria-pressed={question.marked}
            onClick={() => dispatch({ type: 'mark' })}
            leadingIcon={<span aria-hidden="true">⚑</span>}
          >
            {question.marked ? 'Marked for review' : 'Mark for review'}
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------------ question */}
      <Card as="article" aria-labelledby={headingId} padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <Heading
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="ui m-0 text-sm font-semibold text-ink focus:outline-none"
          >
            {single ? (
              <span className="mono font-normal text-ink-3">{item.id}</span>
            ) : (
              <>
                Question {state.index + 1}
                <span className="mono ml-2 text-2xs font-normal text-ink-3">{item.id}</span>
              </>
            )}
            {headingSuffix ? <span className="ml-2">{headingSuffix}</span> : null}
          </Heading>
          {item.tierLabel ? (
            <Badge tone="outline">{item.tierLabel}</Badge>
          ) : (
            <DifficultyPill points={item.points} showMeaning />
          )}
          <Badge tone="outline">{item.levelLabel}</Badge>
          <span className="mono ml-auto text-2xs text-ink-3">
            about {Math.max(15, Math.round(item.estSeconds / 15) * 15)}s
          </span>
        </div>

        <p className="statement prose-measure mt-4 mb-0 text-ink">
          <RichText text={item.statement} math={item.math} />
        </p>

        {item.figure ? <FigureRenderer figure={item.figure} problemId={item.id} /> : null}

        <div className="mt-5">
          <ChoiceList
            key={item.id}
            choices={item.choices}
            selected={question.selected}
            onSelect={pick}
            revealAnswer={done}
            pending={pendingPick}
            idPrefix={`choice-${item.id}`}
            math={item.math}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={check} disabled={!canCheck}>
            Check
          </Button>
          <p className="ui m-0 text-xs text-ink-3" aria-live="polite">
            {question.selected === null
              ? 'Pick an answer, then check it.'
              : question.solved && !pendingPick
                ? 'Solved.'
                : null}
          </p>
          {/* Not a live region: a standing hint, read in order, never announced. */}
          <p
            className="ui m-0 basis-full text-xs text-ink-3 sm:ml-auto sm:basis-auto"
            data-shortcut-hint
          >
            {`Keyboard: A-${lastKey} to choose, Enter to check`}
          </p>
        </div>

        <PracticeFeedback item={item} checkedKey={question.checked} done={done} />

        <HintLadder
          key={`hints-${item.id}`}
          problemId={item.id}
          hints={item.hints}
          revealedTo={question.hints}
          onReveal={(detail: HintRevealDetail) => dispatch({ type: 'hint', level: detail.level })}
          headingLevel={headingLevel === 1 ? 2 : 3}
          math={item.math}
        />

        {done ? (
          <SolutionTabs
            key={`solution-${item.id}`}
            reliable={item.solutions.reliable}
            elegant={item.solutions.elegant}
            math={item.math}
          />
        ) : null}

        {done && item.whyOnTest ? (
          <p className="mt-6 mb-0 border-t border-rule pt-4 text-sm text-ink-2">
            <span className="font-medium text-ink">Why this is on the test: </span>
            {item.whyOnTest}
          </p>
        ) : null}

        {single ? (
          /*
            Without JavaScript nothing can be checked, so the solution is printed for the reader
            who will never get to press Check. The hints above are plain <details> and already
            open without script.
          */
          <noscript>
            <section className="mt-6 border-t border-rule pt-4">
              <h2 className="m-0 text-sm font-semibold text-ink">Solution</h2>
              <p className="mt-2 mb-0 text-sm text-ink-2">
                <RichText text={item.solutions.reliable} math={item.math} />
              </p>
            </section>
          </noscript>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ bottom bar */}
      {single ? null : (
        <nav
          aria-label="Questions"
          className="no-print sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-20 mt-4 flex items-center justify-between gap-2 rounded-card border border-rule bg-surface p-2 shadow-xs sm:bottom-2"
        >
          <Button onClick={() => go(state.index - 1)} disabled={state.index === 0}>
            Back
          </Button>
          <QuestionNavigator
            questions={state.questions}
            index={state.index}
            onGo={go}
            onFinish={finish}
          />
          {last ? (
            <Button variant="primary" onClick={finish}>
              Finish
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(state.index + 1)}>
              Next
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
