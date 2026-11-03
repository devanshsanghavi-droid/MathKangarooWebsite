'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
    return (
      <div>
        <h2 className="m-0 text-lg">Your map</h2>
        <p className="prose-measure mt-2 mb-6 text-ink-2">
          {result.correct} of {result.asked} correct. What matters is not the score - it is which
          skills the misses point at, and what has to come first.
        </p>

        <h3 className="m-0 text-base">Strand by strand</h3>
        <ul className="mt-3 grid list-none gap-2 p-0">
          {result.strands.map((strand) => (
            <li
              key={strand.strand}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2"
            >
              <span className="mono text-2xs text-ink-3">{strand.strand}</span>
              <span className="flex-1 text-sm text-ink">{STRAND_META[strand.strand].name}</span>
              {strand.asked === 0 ? (
                <span className="text-xs text-ink-3">not reached in 15 questions</span>
              ) : (
                <span className="mono text-2xs text-ink-2">
                  {strand.correct} / {strand.asked}
                </span>
              )}
            </li>
          ))}
        </ul>

        <h3 className="mt-8 text-base">Six weeks, in order</h3>
        {result.planOrder.length === 0 ? (
          <p className="prose-measure mt-2 text-ink-2">
            Nothing came up that needs fixing first. Work the Atlas by strand, or take a longer run
            at the 5-point gateways.
          </p>
        ) : (
          <>
            <p className="prose-measure mt-2 mb-4 text-sm text-ink-3">
              Ordered so nothing is studied before what it needs. The first week is the deepest
              thing the misses rest on, not the first thing you got wrong.
            </p>
            <ol className="m-0 grid list-none gap-3 p-0">
              {result.plan
                .filter((week) => week.skillIds.length > 0)
                .map((week) => (
                  <li key={week.week} className="rounded-sm border border-rule bg-surface p-3">
                    <p className="m-0 text-xs font-semibold text-ink">Week {week.week}</p>
                    <ul className="m-0 mt-2 flex flex-wrap list-none gap-2 p-0">
                      {week.skillIds.map((id) => (
                        <li key={id}>
                          <Link
                            href={`/skill/${id}`}
                            className="inline-flex items-baseline gap-1.5 rounded-sm border border-rule px-2 py-1 text-xs no-underline hover:border-rule-strong"
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
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-rule pt-6">
          <button
            type="button"
            onClick={discard}
            className="cursor-pointer rounded-sm border border-rule-strong bg-surface px-4 py-2 text-sm text-ink"
          >
            Start again
          </button>
          <Link
            href={`/atlas?band=${result.band}`}
            className="rounded-sm border border-accent-600 bg-accent-100 px-4 py-2 text-sm font-medium text-ink no-underline"
          >
            See it on the Atlas
          </Link>
        </div>
        <p className="mt-4 mb-0 text-xs text-ink-3">
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
      <div>
        <div className="mb-5">
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 text-sm text-ink-2">
            <span className="mono">
              {done + 1} of at most {MAX_ITEMS}
            </span>
            <DifficultyPill points={problem.points} />
            <span className="text-xs text-ink-3">
              No feedback until the end - this is a measurement, not practice.
            </span>
          </p>
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={MAX_ITEMS}
            aria-label="Diagnostic progress"
          >
            <div
              className="h-full bg-accent-600"
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

        <p className="mt-6 mb-0 text-xs text-ink-3">
          <button type="button" onClick={discard} className="cursor-pointer underline">
            Stop and discard
          </button>
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------------- the start */
  return (
    <div>
      {resumable ? (
        <div className="mb-6 rounded-sm border border-accent-600 bg-accent-100 p-4">
          <p className="m-0 text-sm text-ink">
            You have a diagnostic in progress - {resumable.state.answers.length} question
            {resumable.state.answers.length === 1 ? '' : 's'} answered.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setState(resumable.state)}
              className="cursor-pointer rounded-sm border border-accent-600 bg-surface px-3 py-1.5 text-sm font-medium text-ink"
            >
              Carry on
            </button>
            <button
              type="button"
              onClick={discard}
              className="cursor-pointer rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-2"
            >
              Discard it
            </button>
          </div>
        </div>
      ) : null}

      <h2 className="m-0 text-lg">Which level do you sit?</h2>
      <p className="prose-measure mt-2 mb-4 text-ink-2">
        About fifteen questions, roughly twenty-five minutes. It gets harder when you are right and
        easier when you are wrong, and it follows the skill graph - so a miss sends you to what that
        skill rests on, not to an unrelated easier question.
      </p>
      <ul className="m-0 flex flex-wrap list-none gap-2 p-0">
        {BANDS.map((option) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => begin(option)}
              aria-pressed={band === option}
              className="cursor-pointer rounded-sm border border-rule-strong bg-surface px-4 py-2 text-sm text-ink hover:border-accent-600"
            >
              Level {option.replace('-', '–')}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 mb-0 text-xs text-ink-3">
        No account, no sign-in, nothing sent anywhere. The result is saved on this device so you can
        close the tab and come back.
      </p>
    </div>
  );
}
