'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import type { Band, ChoiceKey } from '@/lib/schemas';
import type { AssessmentProblem } from '@/lib/assessment';
import { BANDS } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import {
  isFinished,
  MAX_ITEMS,
  nextItem,
  recordAnswer,
  startDiagnostic,
  summarise,
  type DiagnosticContent,
  type DiagnosticState,
} from '@/lib/diagnostic';
import { ProblemCardView } from '@/components/ProblemCardView';
import { DifficultyPill } from '@/components/DifficultyPill';
import { Button, ButtonLink, Card, CardHeader, ProgressBar } from '@/components/ui';

/**
 * The diagnostic, running entirely in the browser.
 *
 * No account, no network, no database: `docs/00-SPEC.md` §2.1 says it must work signed out, and
 * the state is plain JSON in `localStorage`, so closing the tab mid-way loses nothing. When
 * accounts arrive in Phase 2 the same state is what gets offered for saving.
 *
 * The problem is rendered by the same `<ProblemCardView>` the rest of the site uses, but with
 * `revealAnswer` never set: this is a measurement, so a student must not be told whether each
 * answer was right until the end. That is the one place the diagnostic deliberately behaves
 * differently from practice.
 */

const STORAGE_KEY = 'ka-diagnostic';

interface Stored {
  state: DiagnosticState;
  savedAt: string;
}

export function DiagnosticRunner({
  content,
  skillNames,
}: {
  content: DiagnosticContent;
  skillNames: Record<string, string>;
}) {
  const [band, setBand] = useState<Band | null>(null);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [resumable, setResumable] = useState<Stored | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Offer to resume before starting anything new.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed?.state?.answers) setResumable(parsed);
      }
    } catch {
      // Corrupted or unavailable storage just means there is nothing to resume.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ state, savedAt: new Date().toISOString() } satisfies Stored),
      );
    } catch {
      // Losing the ability to resume is not a reason to stop the diagnostic.
    }
  }, [state]);

  const problem: AssessmentProblem | null = useMemo(
    () => (state ? nextItem(content, state) : null),
    [content, state],
  );
  const result = useMemo(
    () => (state && (isFinished(state) || !problem) ? summarise(content, state) : null),
    [content, state, problem],
  );

  function begin(chosen: Band) {
    setBand(chosen);
    setResumable(null);
    setState(startDiagnostic(content, chosen));
  }

  function answer(chosenKey: ChoiceKey) {
    if (!state || !problem) return;
    const correct = problem.choices.some((choice) => choice.key === chosenKey && choice.correct);
    setState(recordAnswer(content, state, problem, correct));
  }

  function discard() {
    setState(null);
    setBand(null);
    setResumable(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do; the next start overwrites it anyway.
    }
  }

  if (!loaded) return null;

  /* ------------------------------------------------------------ the result */
  if (result) {
    const plannedWeeks = result.plan.filter((week) => week.skillIds.length > 0);
    return (
      <div className="grid gap-6">
        <Card as="section" aria-labelledby="diagnostic-result" padding="lg">
          <CardHeader
            titleId="diagnostic-result"
            title="Your map"
            description={`Level ${result.band}, ${result.asked} questions.`}
          />
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <p className="ui m-0">
              <span className="text-4xl leading-none font-semibold text-ink tabular-nums">
                {result.correct}
              </span>
              <span className="ml-1 text-lg text-ink-2 tabular-nums">/ {result.asked}</span>
              <span className="mt-1 block text-xs text-ink-2">correct</span>
            </p>
            <p className="prose-measure m-0 text-ink-2">
              {result.correct} of {result.asked} correct. What matters is not the score: it is which
              skills the misses point at, and what has to come first.
            </p>
          </div>

          <h3 className="ui mt-6 mb-0 text-base font-semibold">Strand by strand</h3>
          <ul className="m-0 mt-3 grid list-none gap-x-8 gap-y-4 p-0 md:grid-cols-2">
            {result.strands.map((strand) => (
              <li key={strand.strand}>
                {strand.asked === 0 ? (
                  <div className="ui flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-ink">
                      <span className="mono mr-2 text-2xs text-ink-3">{strand.strand}</span>
                      {STRAND_META[strand.strand].name}
                    </span>
                    <span className="text-ink-2">not reached in 15 questions</span>
                  </div>
                ) : (
                  <ProgressBar
                    value={strand.correct}
                    max={strand.asked}
                    unit="correct"
                    label={
                      <>
                        <span className="mono mr-2 text-2xs text-ink-3">{strand.strand}</span>
                        {STRAND_META[strand.strand].name}
                      </>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="diagnostic-plan" padding="lg">
          <CardHeader
            titleId="diagnostic-plan"
            title="Six weeks, in order"
            description={
              result.planOrder.length === 0
                ? undefined
                : 'Ordered so nothing is studied before what it needs. The first week is the deepest thing the misses rest on, not the first thing you got wrong.'
            }
          />
          {result.planOrder.length === 0 ? (
            <p className="prose-measure mt-3 mb-0 text-ink-2">
              Nothing came up that needs fixing first. Work the Atlas by strand, or take a longer
              run at the 5-point gateways.
            </p>
          ) : (
            <ol className="m-0 mt-4 grid list-none gap-3 p-0 md:grid-cols-2">
              {plannedWeeks.map((week) => (
                <li key={week.week} className="rounded-control border border-rule p-3">
                  <p className="ui m-0 text-xs font-semibold text-ink">Week {week.week}</p>
                  <ul className="m-0 mt-2 flex flex-wrap list-none gap-2 p-0">
                    {week.skillIds.map((id) => (
                      <li key={id}>
                        <Link
                          href={`/skill/${id}`}
                          className="ui inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-rule-strong px-3 text-xs no-underline hover:bg-surface-2"
                        >
                          <span className="mono text-2xs text-ink-3">{id}</span>
                          <span className="text-ink">{skillNames[id] ?? id}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/atlas?band=${result.band}`} variant="primary">
            See it on the Atlas
          </ButtonLink>
          <Button variant="secondary" onClick={discard}>
            Start again
          </Button>
        </div>
        <p className="ui m-0 text-xs text-ink-2">
          This result is saved on this device only. Nothing was sent anywhere, and no account was
          needed. When accounts arrive you will be offered the chance to keep it.
        </p>
      </div>
    );
  }

  /* ----------------------------------------------------------- in progress */
  if (state && problem) {
    const done = state.answers.length;
    return (
      <div className="grid gap-4">
        <div className="ui sticky top-[var(--header-height)] z-20 -mx-4 border-b border-rule bg-surface px-4 py-3 sm:mx-0 sm:rounded-card sm:border sm:shadow-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="m-0 text-sm font-semibold text-ink tabular-nums">
              Question {done + 1}{' '}
              <span className="font-normal text-ink-2">of at most {MAX_ITEMS}</span>
            </p>
            <DifficultyPill points={problem.points} />
            <Button variant="ghost" size="sm" onClick={discard} className="ml-auto">
              Stop and discard
            </Button>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-track"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={MAX_ITEMS}
            aria-valuetext={`${done} of at most ${MAX_ITEMS} answered`}
            aria-label="Diagnostic progress"
          >
            <div
              className="h-full rounded-pill bg-accent-600 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${Math.round((done / MAX_ITEMS) * 100)}%` }}
            />
          </div>
        </div>

        <ProblemCardView
          problem={problem}
          headingLevel={2}
          showSkills={false}
          mode="assessment"
          onAnswer={answer}
        />

        <p className="ui m-0 text-xs text-ink-2">
          No feedback until the end. This is a measurement, not practice.
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------------- the start */
  return (
    <div className="grid gap-6">
      {resumable ? (
        <Card padding="md" className="border-accent-600">
          <p className="ui m-0 text-sm text-ink">
            You have a diagnostic in progress: {resumable.state.answers.length} question
            {resumable.state.answers.length === 1 ? '' : 's'} answered.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => setState(resumable.state)}>
              Carry on
            </Button>
            <Button variant="secondary" size="sm" onClick={discard}>
              Discard it
            </Button>
          </div>
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="diagnostic-start" padding="lg">
        <CardHeader titleId="diagnostic-start" title="Which level do you sit?" />
        <p className="prose-measure mt-2 mb-0 text-ink-2">
          About fifteen questions, roughly twenty-five minutes. It gets harder when you are right
          and easier when you are wrong, and it follows the skill graph, so a miss sends you to what
          that skill rests on, not to an unrelated easier question.
        </p>
        <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-6">
          {BANDS.map((option) => (
            <li key={option}>
              <Button
                variant={band === option ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onClick={() => begin(option)}
                aria-pressed={band === option}
              >
                Level {option}
              </Button>
            </li>
          ))}
        </ul>
        <p className="ui mt-5 mb-0 text-xs text-ink-2">
          No account, no sign-in, nothing sent anywhere. The result is saved on this device so you
          can close the tab and come back.
        </p>
      </Card>
    </div>
  );
}
