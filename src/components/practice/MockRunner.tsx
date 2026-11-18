'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Band, ChoiceKey } from '@/lib/schemas';
import type { AssessmentProblem } from '@/lib/assessment';
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
import { saveAttempt, saveSession } from '@/lib/local-progress';
import { ProblemCardView } from '@/components/ProblemCardView';
import { MockReportView } from './MockReport';
import { Button, ButtonLink, buttonClasses, Card, CardHeader } from '@/components/ui';

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
  /** The trimmed bank from `@/lib/assessment`: a mock shows no hints, solutions or feedback. */
  problems: readonly AssessmentProblem[];
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

  // Once the paper is scored, every answered question becomes an ordinary attempt and the
  // paper a session (docs/07 section 5), exactly once: `recorded` is saved with the run, so a
  // refresh on the report does not count it twice.
  useEffect(() => {
    if (!state?.finishedAt || !report || state.recorded) return;
    const at = state.finishedAt;
    for (const id of state.problemIds) {
      const problem = problemsById.get(id);
      const chosen = state.answers[id]?.chosenKey ?? null;
      if (!problem || chosen === null) continue;
      saveAttempt([problem.skills.primary, ...problem.skills.secondary], {
        problemId: id,
        points: problem.points,
        correct: problem.choices.some((choice) => choice.key === chosen && choice.correct),
        hintsUsed: 0,
        at,
      });
    }
    saveSession({
      kind: 'mock',
      exam: 'KA',
      at,
      score: report.score,
      max: report.maxScore,
      correct: report.tiers.reduce((sum, tier) => sum + tier.correct, 0),
      total: state.problemIds.length,
      durationMs: Math.max(0, Date.parse(at) - Date.parse(state.startedAt)),
    });
    setState((current) => (current ? { ...current, recorded: true } : current));
  }, [state, report, problemsById]);

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
          <Button variant="primary" onClick={discard}>
            Take another
          </Button>
          <ButtonLink href="/practice/diagnostic" variant="secondary">
            Take the diagnostic instead
          </ButtonLink>
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
    const isLast = state.current === state.problemIds.length - 1;

    return (
      <div className="grid gap-4">
        {/* The test bar: the clock, where you are, and the way out. */}
        <div className="ui sticky top-[var(--header-height)] z-20 -mx-4 border-b border-rule bg-surface px-4 py-3 sm:mx-0 sm:rounded-card sm:border sm:shadow-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p
              className="mono m-0 text-xl font-semibold text-ink tabular-nums"
              role="timer"
              aria-label={`${formatClock(left)} remaining`}
            >
              {formatClock(left)}
            </p>
            <p className="m-0 text-sm text-ink-2">
              <span className="font-semibold text-ink">
                Question {state.current + 1} of {state.problemIds.length}
              </span>
              <span className="ml-3 text-xs">
                {blanks} blank, {countFlagged(state)} flagged
              </span>
            </p>
            <Button variant="secondary" size="sm" onClick={finish} className="ml-auto">
              Finish now
            </Button>
          </div>
        </div>

        {shouldNudge(state, now) && !dismissedNudge ? (
          /*
            A clock warning, not answer feedback - so no reserved red (docs/05 §2). Urgency is
            carried by role="alert", a 2px neutral border and the glyph, which also survives
            greyscale.
          */
          <div role="alert" className="rounded-card border-2 border-rule-strong bg-surface-3 p-4">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissedNudge(true)}
              className="mt-2"
            >
              Understood
            </Button>
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
            {/* The bottom bar: answer state, mark for review, back and next. */}
            <div className="ui flex flex-wrap items-center gap-3 rounded-card border border-rule bg-surface p-3 shadow-xs">
              <p className="m-0 text-sm text-ink-2">
                {answer?.chosenKey ? (
                  <>
                    Answered <span className="mono font-semibold text-ink">{answer.chosenKey}</span>
                  </>
                ) : (
                  'Not answered'
                )}
              </p>
              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={answer?.flagged ?? false}
                className={buttonClasses({
                  variant: 'secondary',
                  size: 'sm',
                  className: answer?.flagged ? 'border-2 border-accent-600 bg-accent-100' : '',
                })}
              >
                <span aria-hidden="true">{answer?.flagged ? '⚑' : '⚐'}</span>
                {answer?.flagged ? 'Flagged for review' : 'Flag for review'}
              </button>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => goTo(Math.max(0, state.current - 1))}
                  disabled={state.current === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="primary"
                  onClick={() => goTo(Math.min(state.problemIds.length - 1, state.current + 1))}
                  disabled={isLast}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}

        <nav
          aria-label="Question navigator"
          className="rounded-card border border-rule bg-surface p-4 shadow-xs"
        >
          <h2 className="ui m-0 text-sm font-semibold text-ink">Navigator</h2>
          <ul className="mt-3 mb-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 p-0">
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
                      'mono relative h-11 w-full cursor-pointer rounded-control text-xs tabular-nums',
                      index === state.current ? 'ring-2 ring-focus ring-offset-1' : '',
                      entry?.flagged ? 'border-[3px] font-bold' : 'border',
                      answered
                        ? 'border-accent-600 bg-accent-100 text-ink'
                        : 'border-rule-strong bg-surface text-ink-2 hover:bg-surface-2',
                    ].join(' ')}
                  >
                    {index + 1}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="ui mt-3 mb-0 flex flex-wrap gap-x-4 text-2xs text-ink-2">
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
    <Card as="section" aria-labelledby="mock-start" padding="lg">
      <CardHeader titleId="mock-start" title="Sit a full paper" />
      <p className="prose-measure mt-2 mb-0 text-ink-2">
        {MOCK_MINUTES} minutes, timed. Exactly the shape of the real thing: a third at 3 points, a
        third at 4, a third at 5, and <strong>nothing deducted for a wrong answer</strong>, so a
        blank is a decision to score zero.
      </p>
      <ul className="m-0 mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {buildable.map((band) => (
          <li key={band}>
            <button
              type="button"
              onClick={() => begin(band)}
              className="ui flex w-full cursor-pointer flex-col items-start gap-1 rounded-control border border-rule-strong bg-surface p-4 text-left transition-colors hover:border-accent-600 hover:bg-surface-2 motion-reduce:transition-none"
            >
              <span className="text-base font-semibold text-ink">Level {band}</span>
              <span className="text-xs text-ink-2">
                {paperSize(band)} questions, {maxScore(band)} points
              </span>
            </button>
          </li>
        ))}
      </ul>
      {buildable.length < BANDS.length ? (
        <p className="mt-4 mb-0 text-xs text-ink-2">
          Only the levels above have enough problems for a full paper yet. A short paper scored out
          of the full total would be worse than none, so the others are not offered until the bank
          can fill them.
        </p>
      ) : null}
      <p className="ui mt-4 mb-0 text-xs text-ink-2">
        No account needed. The run is saved on this device, so a refresh, or closing the laptop,
        restores your answers and the timer keeps running, exactly as it would in a hall.
      </p>
    </Card>
  );
}
