'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChoiceKey, Points, Problem } from '@/lib/schemas';
import { ChoiceList } from '@/components/ChoiceList';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { FigureRenderer } from '@/components/FigureRenderer';
import { HintLadder } from '@/components/HintLadder';
import { DifficultyPill, TIER_MEANING } from '@/components/DifficultyPill';
import { advance, LADDER_TARGET, ladderState, streakDots } from '@/lib/ladder';
import { ladderAttempts, saveAttempt } from '@/lib/local-progress';
import { track } from '@/lib/telemetry/client';
import { useProgress } from '@/components/mastery/useProgress';

/**
 * The exercise view — docs/05-DESIGN-DIRECTION.md §7.3.
 *
 * One problem at a time, streak dots at the top, a sticky action bar at the bottom, and
 * **immediate distractor-specific feedback**. That last part is the whole reason the site
 * exists and is the one thing §7.3 says explicitly not to trade away for Khan's
 * check-then-reveal: the moment a student picks the wrong answer, they read the exact piece
 * of reasoning that produces it, in their own voice.
 *
 * Attempts are recorded once per problem per visit — the FIRST selection. A student may then
 * change their answer freely; Kangaroo has no penalty for a wrong answer and the point here is
 * to learn, not to score. But scoring the second click would let a student walk the choices
 * until the panel turned green and record that as a solve.
 *
 * Progress lives in localStorage and nowhere else. No account, no network, nothing sent.
 */
export function LadderRunner({
  skillId,
  skillName,
  points,
  problems,
}: {
  skillId: string;
  skillName: string;
  points: Points;
  problems: Problem[];
}) {
  const progress = useProgress();
  const attempts = ladderAttempts(progress, skillId, points);
  const problemIds = useMemo(() => problems.map((problem) => problem.id), [problems]);
  const state = ladderState(problemIds, attempts);

  /*
   * `index` stays null until the student actually does something, and the problem on screen
   * follows `state.startIndex` until then.
   *
   * `useState(state.startIndex)` was wrong: useSyncExternalStore hands back the SERVER
   * snapshot during hydration, so the initialiser always saw an empty progress file and every
   * returning student was dropped back on problem 1 rather than the first one they had not
   * solved. Pinning on first interaction rather than in an effect also stops the opposite
   * failure — answering correctly changes startIndex, which would otherwise yank the next
   * problem onto the screen while the student was still reading their feedback.
   */
  const [index, setIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<ChoiceKey | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [scored, setScored] = useState<Set<string>>(() => new Set());

  const current = index ?? state.startIndex;
  const problem = problems[current];

  /*
   * `ladder_start` fires once per mount and `ladder_complete` once per rung finished. Both are
   * guarded by refs rather than by the render: a re-render caused by the progress store
   * updating would otherwise re-announce a completion the student reached a moment ago, and
   * the funnel would count one student finishing a ladder several times.
   */
  const announcedStart = useRef(false);
  const announcedComplete = useRef(false);
  useEffect(() => {
    if (announcedStart.current) return;
    announcedStart.current = true;
    track('ladder_start', { surface: 'skill-ladder', skillId, points });
  }, [points, skillId]);
  useEffect(() => {
    if (!state.complete || announcedComplete.current) return;
    announcedComplete.current = true;
    track('ladder_complete', {
      surface: 'skill-ladder',
      skillId,
      points,
      score: state.solved,
      outOf: state.total,
    });
  }, [points, skillId, state.complete, state.solved, state.total]);

  const onSelect = useCallback(
    (key: ChoiceKey) => {
      setSelected(key);
      setIndex(current);
      if (!problem || scored.has(problem.id)) return;
      const choice = problem.choices.find((candidate) => candidate.key === key);
      setScored((current) => new Set(current).add(problem.id));
      saveAttempt([problem.skills.primary, ...problem.skills.secondary], {
        problemId: problem.id,
        points: problem.points,
        correct: choice?.correct ?? false,
        hintsUsed: hintLevel,
        at: new Date().toISOString(),
      });
      /*
       * WHICH option, not just right or wrong. This single field is what turns the bank into
       * a live map of how students actually think: every wrong choice already stores the
       * misconception that produces it, so counting the choices counts the misconceptions.
       */
      track('choice_select', {
        surface: 'skill-ladder',
        context: 'ladder',
        problemId: problem.id,
        skillId,
        points: problem.points,
        band: problem.band,
        choiceKey: key,
        correct: choice?.correct ?? false,
        hintLevel,
      });
    },
    [current, hintLevel, problem, scored, skillId],
  );

  const next = useCallback(() => {
    setIndex(advance(current, problems.length));
    setSelected(null);
    setHintLevel(0);
  }, [current, problems.length]);

  if (!problem) {
    return (
      <div className="content-column px-4 py-8">
        <h1 className="text-2xl">Nothing on this rung yet</h1>
        <p className="reading mt-3 text-ink-2">
          No {points}-point problems tagged {skillId} have been written yet.
        </p>
        <p className="mt-4">
          <Link href={`/skill/${skillId}`}>Back to {skillName}</Link>
        </p>
      </div>
    );
  }

  const answeredCorrectly =
    selected !== null && problem.choices.some((c) => c.key === selected && c.correct);

  return (
    <div className="content-column px-4 pt-6 pb-44 sm:pb-28">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/atlas" className="no-underline hover:underline">
              Atlas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/skill/${skillId}`} className="no-underline hover:underline">
              {skillName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink-2">{points}-point ladder</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-xl">
          {skillName}
          <span className="visually-hidden">, {points}-point ladder</span>
        </h1>
        <DifficultyPill points={points} showMeaning />
      </header>
      <p className="mt-1 mb-0 text-sm text-ink-3">{TIER_MEANING[points]}</p>

      {/* Streak dots. The sentence beside them is what makes this legible without colour. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-rule bg-surface p-3">
        <span
          role="img"
          aria-label={`Streak: ${Math.min(state.streak, LADDER_TARGET)} of ${LADDER_TARGET} correct in a row.`}
          className="flex shrink-0 gap-1.5"
        >
          {streakDots(state.streak).map((dot, position) => (
            <span
              key={position}
              aria-hidden="true"
              className={[
                'block h-3.5 w-3.5 rounded-lg border',
                dot === 'filled' ? 'border-accent-600 bg-accent-600' : 'border-rule-strong',
              ].join(' ')}
            />
          ))}
        </span>
        <p className="m-0 flex-1 text-sm text-ink-2">
          {state.complete
            ? `Ladder finished — ${LADDER_TARGET} in a row. Keep going, or move up a tier.`
            : `${LADDER_TARGET} in a row to finish this ladder.`}
        </p>
        <span className="mono text-2xs text-ink-3">
          {state.solved}/{state.total} solved
        </span>
      </div>

      <article aria-labelledby="exercise-problem" className="mt-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="exercise-problem" className="m-0 text-sm font-normal">
            <Link href={`/problem/${problem.id}`} className="mono no-underline hover:underline">
              {problem.id}
            </Link>
          </h2>
          <span className="mono ml-auto text-2xs text-ink-3">
            about {Math.round(problem.estSeconds / 15) * 15}s
          </span>
        </div>

        <p className="statement prose-measure mt-3 mb-0 text-ink">{problem.statement}</p>

        {problem.figure ? <FigureRenderer figure={problem.figure} problemId={problem.id} /> : null}

        <div className="mt-5">
          <ChoiceList
            choices={problem.choices}
            selected={selected}
            onSelect={onSelect}
            revealAnswer={answeredCorrectly}
            idPrefix={`ladder-${problem.id}`}
          />
          <FeedbackPanel problem={problem} selectedKey={selected} />
        </div>

        {hintLevel > 0 ? (
          <HintLadder problemId={problem.id} hints={problem.hints} revealedTo={hintLevel} />
        ) : null}
      </article>

      {/*
        The action bar.

        Two wrong versions came before this one, and both are worth recording. `fixed inset-x-0`
        spanned underneath the 260px skill rail and centred on the window, leaving it ~130px to
        the left of the problem it acts on. `sticky` fixed the alignment but broke something
        worse: a sticky element still occupies its place in the flow, so on a 360px phone it
        settled directly over answer choices B and C and no amount of scrolling could move them
        clear — two of the five answers were simply unreachable.

        So: fixed, but with its left edge pinned to the start of the content area rather than to
        the window, and `content-column` inside it — which lands it in exactly the same 720px
        column as the problem. The page carries matching bottom padding, so the last thing on it
        is space rather than covered content, and every choice can always be scrolled clear.
      */}
      <div className="no-print fixed inset-x-0 bottom-[68px] z-20 border-t border-rule bg-surface-3 px-4 py-3 shell:left-[var(--sidebar-width)] sm:bottom-0 sm:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="content-column flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = Math.min(3, hintLevel + 1);
              setHintLevel(next);
              track('hint_reveal', {
                surface: 'skill-ladder',
                problemId: problem.id,
                skillId,
                hintLevel: next,
              });
            }}
            disabled={hintLevel >= 3}
            className="tap-target ui cursor-pointer rounded-sm border border-hint-border bg-hint-100 px-3 text-sm font-medium text-hint-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hintLevel === 0 ? 'Show a hint' : `Next hint (${hintLevel}/3)`}
          </button>
          <button
            type="button"
            onClick={next}
            className="tap-target ui cursor-pointer rounded-sm border border-rule-strong bg-surface px-3 text-sm text-ink-2"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={next}
            className="tap-target ui ml-auto cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-4 text-sm font-medium text-ink"
          >
            Next problem
          </button>
        </div>
      </div>
    </div>
  );
}
