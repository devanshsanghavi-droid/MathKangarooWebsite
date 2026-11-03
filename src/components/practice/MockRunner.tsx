'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Band, ChoiceKey, Problem } from '@/lib/schemas';
import { BANDS } from '@/lib/schemas';
import {
  countBlanks,
  countFlagged,
  formatClock,
  isExpired,
  MOCK_MINUTES,
  maxScore,
  paperSize,
  remainingMs,
  scoreMock,
  shouldNudge,
  startMock,
  type MockState,
} from '@/lib/mock';
import { ProblemCardView } from '@/components/ProblemCardView';
import { MockReportView } from './MockReport';

/**
 * A full mock exam, in the browser, with no account.
 *
 * The timer is the part worth being careful about. It is never counted down in memory: the
 * state stores when the paper started, and the time left is computed from the clock every
 * second. That is what makes a refresh at minute 40 restore the timer rather than reset it,
 * and what makes closing the laptop for ten minutes cost ten minutes, as it would in a hall.
 */

const STORAGE_KEY = 'ka-mock';

export function MockRunner({
  problems,
  skillNames,
}: {
  problems: readonly Problem[];
  skillNames: Record<string, string>;
}) {
  const [state, setState] = useState<MockState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [dismissedNudge, setDismissedNudge] = useState(false);
  const enteredAt = useRef<number>(Date.now());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as MockState);
    } catch {
      // Nothing to resume.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Losing resumability is not a reason to stop the exam.
    }
  }, [state]);

  // One tick a second is enough for a clock and cheap enough not to matter.
  useEffect(() => {
    if (!state || state.finishedAt) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const finish = useCallback(() => {
    setState((current) =>
      current && !current.finishedAt
        ? { ...current, finishedAt: new Date().toISOString() }
        : current,
    );
  }, []);

  // Time runs out: submit whatever is there, exactly as an invigilator would.
  useEffect(() => {
    if (state && !state.finishedAt && isExpired(state, now)) finish();
  }, [state, now, finish]);

  const problemsById = useMemo(
    () => new Map(problems.map((problem) => [problem.id, problem])),
    [problems],
  );

  const report = useMemo(
    () => (state?.finishedAt ? scoreMock(problems, state) : null),
    [problems, state],
  );

  /** Bank the time spent on the question being left, then move. */
  function goTo(index: number) {
    setState((current) => {
      if (!current) return current;
      const leavingId = current.problemIds[current.current];
      const spent = Date.now() - enteredAt.current;
      enteredAt.current = Date.now();
      if (!leavingId) return { ...current, current: index };
      const answer = current.answers[leavingId];
      if (!answer) return { ...current, current: index };
      return {
        ...current,
        current: index,
        answers: {
          ...current.answers,
          [leavingId]: { ...answer, msSpent: answer.msSpent + spent },
        },
      };
    });
  }

  function choose(key: ChoiceKey) {
    setState((current) => {
      if (!current) return current;
      const id = current.problemIds[current.current];
      if (!id) return current;
      const answer = current.answers[id];
      if (!answer) return current;
      return { ...current, answers: { ...current.answers, [id]: { ...answer, chosenKey: key } } };
    });
  }

  function toggleFlag() {
    setState((current) => {
      if (!current) return current;
      const id = current.problemIds[current.current];
      if (!id) return current;
      const answer = current.answers[id];
      if (!answer) return current;
      return {
        ...current,
        answers: { ...current.answers, [id]: { ...answer, flagged: !answer.flagged } },
      };
    });
  }

  function begin(band: Band) {
    const started = startMock(problems, band, Math.floor(Date.now() / 86_400_000), new Date());
    if (!started) return;
    enteredAt.current = Date.now();
    setDismissedNudge(false);
    setState(started);
  }

  function discard() {
    setState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The next start overwrites it anyway.
    }
  }

  if (!loaded) return null;

  /* ------------------------------------------------------------- the report */
  if (state && report) {
    return (
      <div>
        <MockReportView report={report} skillNames={skillNames} problemsById={problemsById} />
        <div className="mt-8 flex flex-wrap gap-3 border-t border-rule pt-6">
          <button
            type="button"
            onClick={discard}
            className="cursor-pointer rounded-sm border border-rule-strong bg-surface px-4 py-2 text-sm text-ink"
          >
            Take another
          </button>
          <Link
            href="/practice/diagnostic"
            className="rounded-sm border border-rule px-4 py-2 text-sm text-ink-2 no-underline"
          >
            Take the diagnostic instead
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- sitting it */
  if (state) {
    const id = state.problemIds[state.current];
    const problem = id ? problemsById.get(id) : undefined;
    const answer = id ? state.answers[id] : undefined;
    const left = remainingMs(state, now);
    const blanks = countBlanks(state);

    return (
      <div>
        <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-rule bg-ground/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p
              className="mono m-0 text-lg font-semibold text-ink tabular-nums"
              role="timer"
              aria-label={`${formatClock(left)} remaining`}
            >
              {formatClock(left)}
            </p>
            <p className="m-0 text-xs text-ink-3">
              Question {state.current + 1} of {state.problemIds.length} · {blanks} blank ·{' '}
              {countFlagged(state)} flagged
            </p>
            <button
              type="button"
              onClick={finish}
              className="ml-auto cursor-pointer rounded-sm border border-rule-strong bg-surface px-3 py-1.5 text-sm text-ink"
            >
              Finish now
            </button>
          </div>
        </div>

        {shouldNudge(state, now) && !dismissedNudge ? (
          /*
            A clock warning, not answer feedback - so no reserved red (docs/05 §2). Urgency is
            carried by role="alert", a 2px neutral border and the glyph, which also survives
            greyscale.
          */
          <div
            role="alert"
            className="mb-5 rounded-sm border-2 border-rule-strong bg-surface-3 p-3"
          >
            <p className="m-0 text-sm font-medium text-ink">
              <span aria-hidden="true" className="mr-2">
                ⏱
              </span>
              Five minutes left, and {blanks} question{blanks === 1 ? ' is' : 's are'} blank.
            </p>
            <p className="m-0 mt-1 text-sm text-ink-2">
              A wrong answer costs nothing here. A blank scores zero for certain; a guess scores
              zero or more. Fill every one of them before the end.
            </p>
            <button
              type="button"
              onClick={() => setDismissedNudge(true)}
              className="mt-2 cursor-pointer text-xs underline"
            >
              Understood
            </button>
          </div>
        ) : null}

        {problem ? (
          <>
            <ProblemCardView
              problem={problem}
              headingLevel={2}
              showSkills={false}
              mode="assessment"
              onAnswer={choose}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="m-0 text-sm text-ink-2">
                {answer?.chosenKey ? (
                  <>
                    Answered <span className="mono font-semibold">{answer.chosenKey}</span>
                  </>
                ) : (
                  'Not answered'
                )}
              </p>
              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={answer?.flagged ?? false}
                className={[
                  'cursor-pointer rounded-sm border px-3 py-1.5 text-sm',
                  answer?.flagged
                    ? 'border-2 border-accent-600 bg-accent-100 font-medium text-ink'
                    : 'border border-rule-strong bg-surface text-ink-2',
                ].join(' ')}
              >
                <span aria-hidden="true" className="mr-1.5">
                  {answer?.flagged ? '⚑' : '⚐'}
                </span>
                {answer?.flagged ? 'Flagged for review' : 'Flag for review'}
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => goTo(Math.max(0, state.current - 1))}
                  disabled={state.current === 0}
                  className="cursor-pointer rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => goTo(Math.min(state.problemIds.length - 1, state.current + 1))}
                  disabled={state.current === state.problemIds.length - 1}
                  className="cursor-pointer rounded-sm border border-rule-strong bg-surface px-3 py-1.5 text-sm text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}

        <nav aria-label="Question navigator" className="mt-8 border-t border-rule pt-5">
          <h2 className="m-0 text-sm font-semibold text-ink">Navigator</h2>
          <ul className="mt-3 flex flex-wrap list-none gap-1.5 p-0">
            {state.problemIds.map((questionId, index) => {
              const entry = state.answers[questionId];
              const answered = entry?.chosenKey !== null && entry?.chosenKey !== undefined;
              return (
                <li key={questionId}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={index === state.current ? 'true' : undefined}
                    aria-label={`Question ${index + 1}${answered ? ', answered' : ', blank'}${
                      entry?.flagged ? ', flagged' : ''
                    }`}
                    /*
                      Answered and flagged are two independent facts, so they are carried by
                      two independent properties - fill for answered, border WEIGHT for
                      flagged. Setting both from the same `border-color` utility let whichever
                      rule happened to come later in the stylesheet win, which is not a
                      decision this component gets to make.
                    */
                    className={[
                      'mono h-8 w-8 cursor-pointer rounded-xs text-xs',
                      index === state.current ? 'ring-2 ring-focus' : '',
                      entry?.flagged ? 'border-[3px] font-bold' : 'border',
                      answered
                        ? 'border-accent-600 bg-accent-100 text-ink'
                        : 'border-rule-strong bg-surface text-ink-2',
                    ].join(' ')}
                  >
                    {index + 1}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 mb-0 flex flex-wrap gap-x-4 text-2xs text-ink-3">
            <span>Filled: answered</span>
            <span>Thick border: flagged for review</span>
            <span>Empty: blank, and a blank scores zero</span>
          </p>
        </nav>
      </div>
    );
  }

  /* ---------------------------------------------------------------- the start */
  const buildable = BANDS.filter((band) => startMock(problems, band, 1, new Date()) !== null);

  return (
    <div>
      <h2 className="m-0 text-lg">Sit a full paper</h2>
      <p className="prose-measure mt-2 mb-4 text-ink-2">
        {MOCK_MINUTES} minutes, timed. Exactly the shape of the real thing: a third at 3 points, a
        third at 4, a third at 5, and <strong>nothing deducted for a wrong answer</strong> - so a
        blank is a decision to score zero.
      </p>
      <ul className="m-0 flex flex-wrap list-none gap-2 p-0">
        {buildable.map((band) => (
          <li key={band}>
            <button
              type="button"
              onClick={() => begin(band)}
              className="cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-4 py-2 text-sm font-medium text-ink"
            >
              Level {band.replace('-', '–')} · {paperSize(band)} questions · {maxScore(band)} points
            </button>
          </li>
        ))}
      </ul>
      {buildable.length < BANDS.length ? (
        <p className="mt-4 mb-0 text-xs text-ink-3">
          Only the levels above have enough problems for a full paper yet. A short paper scored out
          of the full total would be worse than none, so the others are not offered until the bank
          can fill them.
        </p>
      ) : null}
      <p className="mt-4 mb-0 text-xs text-ink-3">
        No account needed. The run is saved on this device, so a refresh - or closing the laptop -
        restores your answers and the timer keeps running, exactly as it would in a hall.
      </p>
    </div>
  );
}
