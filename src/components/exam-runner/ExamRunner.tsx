'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, buttonClasses, cx } from '@/components/ui';
import type { ChoiceKey } from '@/lib/schemas';
import {
  countBlanks,
  countFlagged,
  currentModule,
  formatClock,
  isLastModule,
  moduleIds,
  nudgeCopy,
  remainingMs,
  shouldNudge,
  spokenClock,
  type ExamSpec,
  type ExamState,
} from '@/lib/exam-engine';
import { ExamQuestion, type ExamQuestionView } from './ExamQuestion';

export interface ExamRunnerProps {
  state: ExamState;
  spec: ExamSpec;
  questions: ReadonlyMap<string, ExamQuestionView>;
  now: Date;
  onChoose: (key: ChoiceKey) => void;
  onClear: () => void;
  onFlag: () => void;
  onGo: (index: number) => void;
  /** Submit the current module (the whole test when it is the last or only module). */
  onSubmit: () => void;
}

/**
 * The sitting itself: the clock, the question, flag for review, the navigator, the blank
 * nudge and a submit confirmation. Every rule is in exam-engine.ts; this renders the state.
 *
 * The clock can be hidden (some students pace better without it), but the five-minute nudge
 * still appears. Nothing here can show right or wrong: the questions arrive as
 * ExamQuestionView, which carries no answer.
 */
export function ExamRunner({
  state,
  spec,
  questions,
  now,
  onChoose,
  onClear,
  onFlag,
  onGo,
  onSubmit,
}: ExamRunnerProps) {
  const [timerHidden, setTimerHidden] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dismissedNudge, setDismissedNudge] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const lastIndex = useRef(state.current);
  const lastModule = useRef(state.moduleIndex);
  const [moduleNotice, setModuleNotice] = useState(false);

  const mod = currentModule(state);
  const ids = moduleIds(state);
  const multiModule = state.modules.length > 1;
  const position = state.current - mod.start;
  const id = state.problemIds[state.current];
  const question = id ? questions.get(id) : undefined;
  const answer = id ? state.answers[id] : undefined;
  const left = remainingMs(state, now);
  const blanks = countBlanks(state, ids);
  const flagged = countFlagged(state, ids);
  const last = isLastModule(state);
  const nudge = shouldNudge(state, now) && dismissedNudge !== state.moduleIndex;
  const nudgeText = nudgeCopy(spec, blanks);

  // A move to another question puts focus on its heading, so a screen reader announces where
  // it landed. Not on first render: the page should not jump on load.
  const currentIndex = state.current;
  useEffect(() => {
    if (lastIndex.current === currentIndex) return;
    lastIndex.current = currentIndex;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [currentIndex]);

  // A new module (submitted, or the clock ran out) closes the confirmation and says so.
  useEffect(() => {
    if (lastModule.current === state.moduleIndex) return;
    lastModule.current = state.moduleIndex;
    setConfirming(false);
    setModuleNotice(true);
  }, [state.moduleIndex]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function cancelConfirm() {
    setConfirming(false);
    submitRef.current?.focus();
  }

  const submitLabel = last ? 'Submit test' : `Submit ${mod.label.toLowerCase()}`;
  const heading = multiModule
    ? `${mod.label}, question ${position + 1}`
    : `Question ${position + 1}`;

  return (
    <div className="grid gap-4">
      {/* The test bar: the clock, where you are, the way out. */}
      <div className="ui sticky top-[var(--header-height)] z-20 -mx-4 border-b border-rule bg-surface px-4 py-3 sm:mx-0 sm:rounded-card sm:border sm:shadow-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            {timerHidden ? (
              <span className="text-sm text-ink-2">Timer hidden</span>
            ) : (
              <p className="mono m-0 text-xl font-semibold text-ink tabular-nums" role="timer">
                <span aria-hidden="true">{formatClock(left)}</span>
                <span className="visually-hidden">{spokenClock(left)} remaining</span>
              </p>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTimerHidden((value) => !value)}
              aria-pressed={timerHidden}
            >
              {timerHidden ? 'Show timer' : 'Hide timer'}
            </Button>
          </div>
          <p className="m-0 text-sm text-ink-2">
            <span className="font-semibold text-ink tabular-nums">
              {multiModule ? `${mod.label} of ${state.modules.length}: ` : ''}
              Question {position + 1} of {mod.count}
            </span>
            <span className="ml-3 text-xs">
              {blanks} blank, {flagged} flagged
            </span>
          </p>
          <button
            ref={submitRef}
            type="button"
            onClick={() => setConfirming(true)}
            className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'ml-auto' })}
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {moduleNotice ? (
        <div role="status" className="rounded-card border border-rule bg-surface-2 p-3">
          <p className="m-0 text-sm text-ink">
            {mod.label} has started. The previous module is closed and its answers are saved.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setModuleNotice(false)} className="mt-1">
            Dismiss
          </Button>
        </div>
      ) : null}

      {nudge ? (
        /*
          A clock warning, not answer feedback, so no feedback colour: urgency is carried by
          role="alert", a heavier neutral border and the words.
        */
        <div role="alert" className="rounded-card border-2 border-rule-strong bg-surface-3 p-4">
          <p className="m-0 text-sm font-medium text-ink">{nudgeText.title}</p>
          <p className="m-0 mt-1 text-sm text-ink-2">{nudgeText.body}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissedNudge(state.moduleIndex)}
            className="mt-2"
          >
            Understood
          </Button>
        </div>
      ) : null}

      {confirming ? (
        <section
          aria-labelledby="exam-confirm-heading"
          className="rounded-card border-2 border-accent-600 bg-surface p-4 shadow-xs"
        >
          <h2
            id="exam-confirm-heading"
            ref={confirmRef}
            tabIndex={-1}
            className="ui m-0 text-base font-semibold text-ink focus:outline-none"
          >
            {last ? 'Submit the test?' : `Submit ${mod.label.toLowerCase()}?`}
          </h2>
          <p className="m-0 mt-2 text-sm text-ink-2">
            {blanks === 0
              ? 'Every question has an answer.'
              : `${blanks} question${blanks === 1 ? ' is' : 's are'} still blank.`}{' '}
            {flagged > 0
              ? `${flagged} ${flagged === 1 ? 'is' : 'are'} flagged for review.`
              : 'Nothing is flagged for review.'}{' '}
            {last
              ? 'You will see your score and every solution next.'
              : 'You cannot come back to this module once the next one starts.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onSubmit}>
              {last ? 'Submit and see my score' : `Submit and start ${nextLabel(state)}`}
            </Button>
            <Button variant="secondary" onClick={cancelConfirm}>
              Keep working
            </Button>
          </div>
        </section>
      ) : null}

      {question ? (
        <>
          <ExamQuestion
            ref={headingRef}
            question={question}
            heading={heading}
            chosenKey={answer?.chosenKey ?? null}
            onChoose={onChoose}
          />
          {/* The bottom bar: answer state, flag for review, back and next. */}
          <div className="ui flex flex-wrap items-center gap-3 rounded-card border border-rule bg-surface p-3 shadow-xs">
            <p className="m-0 text-sm text-ink-2" aria-live="polite">
              {answer?.chosenKey ? (
                <>
                  Answered <span className="mono font-semibold text-ink">{answer.chosenKey}</span>
                </>
              ) : (
                'Not answered'
              )}
            </p>
            {answer?.chosenKey ? (
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear answer
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={onFlag}
              aria-pressed={answer?.flagged ?? false}
              className={answer?.flagged ? 'border-2 border-accent-600 bg-accent-100' : ''}
              leadingIcon={<span aria-hidden="true">{answer?.flagged ? '⚑' : '⚐'}</span>}
            >
              {answer?.flagged ? 'Flagged for review' : 'Flag for review'}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => onGo(state.current - 1)} disabled={position === 0}>
                Previous
              </Button>
              {position === mod.count - 1 ? (
                <Button variant="primary" onClick={() => setConfirming(true)}>
                  {last ? 'Review and submit' : 'Review and submit module'}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => onGo(state.current + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="m-0 text-ink-2" role="status">
          This question could not be shown.
        </p>
      )}

      <nav
        aria-label="Question navigator"
        className="rounded-card border border-rule bg-surface p-4 shadow-xs"
      >
        <h2 className="ui m-0 text-sm font-semibold text-ink">
          {multiModule ? `${mod.label} navigator` : 'Navigator'}
        </h2>
        <ul className="mt-3 mb-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 p-0">
          {ids.map((questionId, offset) => {
            const entry = state.answers[questionId];
            const answered = (entry?.chosenKey ?? null) !== null;
            const index = mod.start + offset;
            const current = index === state.current;
            return (
              <li key={questionId}>
                <button
                  type="button"
                  onClick={() => onGo(index)}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`Question ${offset + 1}${answered ? ', answered' : ', blank'}${
                    entry?.flagged ? ', flagged' : ''
                  }`}
                  /*
                    Answered and flagged are independent facts, carried by independent
                    properties: fill for answered, a flag glyph and a heavier border for
                    flagged, a ring for current. None of them relies on colour alone.
                  */
                  className={cx(
                    'mono relative h-11 w-full cursor-pointer rounded-control text-xs tabular-nums',
                    current && 'ring-2 ring-accent-600 ring-offset-1 ring-offset-surface',
                    entry?.flagged ? 'border-[3px] font-bold' : 'border',
                    answered
                      ? 'border-accent-600 bg-accent-100 text-ink'
                      : 'border-rule-strong bg-surface text-ink-2 hover:bg-surface-2',
                  )}
                >
                  {offset + 1}
                  {entry?.flagged ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-1 text-xs text-ink"
                    >
                      ⚑
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="ui mt-3 mb-0 flex flex-wrap gap-x-4 text-2xs text-ink-2">
          <span>Filled: answered</span>
          <span>Flag and thick border: flagged for review</span>
          <span>Ring: the question on screen</span>
        </p>
      </nav>
    </div>
  );
}

function nextLabel(state: ExamState): string {
  return (state.modules[state.moduleIndex + 1]?.label ?? 'the next module').toLowerCase();
}
