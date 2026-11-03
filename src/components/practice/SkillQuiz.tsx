'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { ChoiceKey, Problem } from '@/lib/schemas';
import { ChoiceList } from '@/components/ChoiceList';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { FigureRenderer } from '@/components/FigureRenderer';
import { DifficultyPill } from '@/components/DifficultyPill';
import { saveAttempt } from '@/lib/local-progress';
import { track } from '@/lib/telemetry/client';

/**
 * The skill quiz - the last row of a unit (docs/05 §7.2).
 *
 * Unlike the ladder, this is a MEASUREMENT: no feedback, no hints, no solution while it is
 * running. A quiz that told you the answer as you went would measure nothing, which is the
 * same reason `ProblemCardView` grew an assessment mode for the diagnostic.
 *
 * The distractor-specific explanations all arrive at the end, together, for every question the
 * student got wrong. That is the part worth reading, and reading five of them in a row is how
 * a student sees a pattern in their own mistakes.
 */
export function SkillQuiz({
  skillId,
  skillName,
  problems,
}: {
  skillId: string;
  skillName: string;
  problems: Problem[];
}) {
  const [answers, setAnswers] = useState<Record<string, ChoiceKey>>({});
  const [submitted, setSubmitted] = useState(false);
  const answeredCount = Object.keys(answers).length;

  const submit = useCallback(() => {
    setSubmitted(true);
    const at = new Date().toISOString();
    for (const problem of problems) {
      const key = answers[problem.id];
      if (!key) continue;
      const choice = problem.choices.find((candidate) => candidate.key === key);
      saveAttempt([problem.skills.primary, ...problem.skills.secondary], {
        problemId: problem.id,
        points: problem.points,
        correct: choice?.correct ?? false,
        hintsUsed: 0,
        at,
      });
      track('choice_select', {
        surface: 'skill-quiz',
        context: 'quiz',
        problemId: problem.id,
        skillId,
        points: problem.points,
        band: problem.band,
        choiceKey: key,
        correct: choice?.correct ?? false,
        hintLevel: 0,
      });
    }
    const score = problems.filter((problem) =>
      problem.choices.some((c) => c.key === answers[problem.id] && c.correct),
    ).length;
    track('quiz_complete', {
      surface: 'skill-quiz',
      skillId,
      score,
      outOf: problems.length,
    });
  }, [answers, problems, skillId]);

  if (problems.length === 0) {
    return (
      <div className="content-column px-4 py-8">
        <h1 className="text-2xl">No quiz yet</h1>
        <p className="reading mt-3 text-ink-2">
          A quiz needs problems, and {skillId} has none written yet.
        </p>
        <p className="mt-4">
          <Link href={`/skill/${skillId}`}>Back to {skillName}</Link>
        </p>
      </div>
    );
  }

  const score = problems.filter((problem) =>
    problem.choices.some((choice) => choice.key === answers[problem.id] && choice.correct),
  ).length;

  return (
    <div className="content-column px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href={`/skill/${skillId}`} className="no-underline hover:underline">
              {skillName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink-2">Skill quiz</li>
        </ol>
      </nav>

      <h1 className="m-0 text-2xl">Skill quiz: {skillName}</h1>
      <p className="reading mt-2 mb-0 text-ink-2">
        {submitted
          ? `You got ${score} of ${problems.length}. Every explanation below is written for the answer you actually chose.`
          : `${problems.length} problems. Nothing is marked until you finish - this one is a measurement.`}
      </p>

      <ol className="mt-6 grid list-none gap-8 p-0">
        {problems.map((problem, position) => (
          <li key={problem.id}>
            <article aria-labelledby={`quiz-${problem.id}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 id={`quiz-${problem.id}`} className="m-0 text-sm font-medium text-ink">
                  Question {position + 1}
                </h2>
                <DifficultyPill points={problem.points} />
                <span className="mono ml-auto text-2xs text-ink-3">{problem.id}</span>
              </div>

              <p className="statement prose-measure mt-3 mb-0 text-ink">{problem.statement}</p>

              {problem.figure ? (
                <FigureRenderer figure={problem.figure} problemId={problem.id} />
              ) : null}

              <div className="mt-4">
                <ChoiceList
                  choices={problem.choices}
                  selected={answers[problem.id] ?? null}
                  onSelect={(key) =>
                    submitted
                      ? undefined
                      : setAnswers((current) => ({ ...current, [problem.id]: key }))
                  }
                  revealAnswer={submitted}
                  idPrefix={`quiz-${problem.id}`}
                />
                {submitted ? (
                  <FeedbackPanel problem={problem} selectedKey={answers[problem.id] ?? null} />
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>

      {submitted ? (
        <p className="mt-8 mb-0 text-sm">
          <Link href={`/skill/${skillId}`}>Back to {skillName}</Link>
        </p>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            className="tap-target ui cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-4 text-sm font-medium text-ink"
          >
            Finish and see the explanations
          </button>
          <span className="text-xs text-ink-3">
            {answeredCount} of {problems.length} answered
          </span>
        </div>
      )}
    </div>
  );
}
