'use client';

import { forwardRef, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { FigureRenderer } from '@/components/FigureRenderer';
import { RichText } from '@/components/math/RichText';
import { SolutionTabs } from '@/components/SolutionTabs';
import { Card, ProgressBar } from '@/components/ui';
import type { PracticeItem } from '@/lib/practice-item';
import {
  blankScores,
  formatClock,
  type ExamReport as Report,
  type ExamSpec,
  type ExamState,
  type GroupResult,
} from '@/lib/exam-engine';

export interface ExamReportProps {
  state: ExamState;
  spec: ExamSpec;
  report: Report;
  /** Full items, fetched for the report: misconceptions and solutions live here only. */
  items: ReadonlyMap<string, PracticeItem>;
  /** Where "work on this" goes for a section (mock) or a skill / topic (section test). */
  focusHref: (entry: GroupResult) => string | null;
  /** Buttons under the report: take another, back to the area. */
  actions: ReactNode;
}

function percent(correct: number, asked: number): number {
  return asked === 0 ? 0 : Math.round((correct / asked) * 100);
}

function scoringLine(spec: ExamSpec): string {
  const rule = spec.scoring;
  if (rule.kind === 'points') {
    return 'Each question scores its own point value when right. A wrong answer costs nothing.';
  }
  if (blankScores(spec)) {
    return `${rule.correct} points for a right answer, ${rule.blank} for a blank, ${rule.wrong} for a wrong one.`;
  }
  return `${rule.correct} point for each right answer. A wrong answer or a blank scores 0.`;
}

/**
 * The report after a mock or section test (docs/07 section 4): the score in the paper's own
 * scoring, an approximate scaled score for a full SAT or ACT mock (labelled as an estimate,
 * always a range), accuracy per section, the three places to work on with links, and every
 * missed question with the misconception behind the letter picked and the solution.
 *
 * Right and wrong are feedback, so they use the feedback colours, and are always spelled out
 * in words as well.
 */
export const ExamReport = forwardRef<HTMLHeadingElement, ExamReportProps>(function ExamReport(
  { state, spec, report, items, focusHref, actions },
  ref,
) {
  const durationMs =
    state.finishedAt !== null ? Date.parse(state.finishedAt) - Date.parse(state.startedAt) : 0;
  const missed = report.questions.filter((q) => q.outcome !== 'correct');
  const breakdown = state.kind === 'mock' ? report.sections : report.groups;
  const breakdownTitle =
    state.kind === 'mock'
      ? `By ${spec.sectionNoun}`
      : spec.bank === 'amc'
        ? 'By topic'
        : 'By skill';

  return (
    <div className="grid gap-6">
      <Card as="section" aria-labelledby="exam-report-heading" padding="lg">
        <h2
          id="exam-report-heading"
          ref={ref}
          tabIndex={-1}
          className="ui m-0 text-lg font-semibold focus:outline-none"
        >
          Your result: {state.title}
        </h2>
        <p className="ui mt-3 mb-0 text-4xl font-semibold text-ink tabular-nums">
          {report.score}
          <span className="text-lg font-normal text-ink-2"> / {report.max}</span>
        </p>
        <p className="mt-2 mb-0 text-sm text-ink-2">
          {report.correct} right, {report.wrong} wrong, {report.blank} blank, out of {report.total}{' '}
          questions. Time used {formatClock(durationMs)}.
        </p>
        <p className="mt-1 mb-0 text-xs text-ink-3">{scoringLine(spec)}</p>

        {report.scale ? (
          <div className="mt-4 rounded-control border border-rule-strong bg-surface-2 p-3">
            <p className="m-0 text-sm text-ink">
              <strong>
                Estimated {spec.label} score: about {report.scale.low} to {report.scale.high}
              </strong>{' '}
              on the {report.scale.min} to {report.scale.max} scale.
            </p>
            <p className="m-0 mt-1 text-xs text-ink-2">
              This is an estimate, not an official score. It is a straight line from the share of
              questions you got right; the real conversion changes from test to test, and these are
              our own practice questions, not official ones.
            </p>
          </div>
        ) : null}

        {report.blank > 0 && !blankScores(spec) ? (
          <p className="mt-4 mb-0 text-sm text-ink-2">
            You left {report.blank} blank. A wrong answer costs nothing on this paper, so a guess on
            each of those would have been worth trying.
          </p>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="exam-breakdown-heading" padding="lg">
        <h2 id="exam-breakdown-heading" className="ui m-0 text-base font-semibold">
          {breakdownTitle}
        </h2>
        <ul className="m-0 mt-4 grid list-none gap-4 p-0">
          {breakdown.map((entry) => (
            <li key={entry.id}>
              <ProgressBar
                value={entry.correct}
                max={entry.asked}
                label={entry.name}
                unit="right"
                size="md"
                numbers={
                  <>
                    {entry.correct} / {entry.asked} right ({percent(entry.correct, entry.asked)}%)
                  </>
                }
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="exam-focus-heading" padding="lg">
        <h2 id="exam-focus-heading" className="ui m-0 text-base font-semibold">
          Three to work on
        </h2>
        {report.focus.length === 0 ? (
          <p className="mt-2 mb-0 text-ink-2">
            Nothing came out wrong. Try a harder paper, or another {spec.sectionNoun}.
          </p>
        ) : (
          <ol className="m-0 mt-3 grid list-none gap-2 p-0">
            {report.focus.map((entry, index) => {
              const href = focusHref(entry);
              const body = (
                <>
                  <span className="mono text-2xs text-ink-3">{index + 1}</span>
                  <span className="flex-1 text-sm text-ink">{entry.name}</span>
                  <span className="mono text-2xs text-ink-2">
                    {entry.correct} / {entry.asked} right
                  </span>
                  {href ? (
                    <span className="text-xs font-semibold text-accent-700">
                      {report.focusLevel === 'section' ? 'Take a section test' : 'Practise this'}
                    </span>
                  ) : null}
                </>
              );
              const classes =
                'flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-control border border-rule bg-surface px-3 py-2';
              return (
                <li key={entry.id}>
                  {href ? (
                    <Link
                      href={href}
                      className={`${classes} no-underline hover:border-rule-strong`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={classes}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <section aria-labelledby="exam-missed-heading" className="grid gap-3">
        <h2 id="exam-missed-heading" className="ui m-0 text-base font-semibold">
          {missed.length === 0
            ? 'Questions you missed: none'
            : `Questions you missed (${missed.length})`}
        </h2>
        {missed.map((result) => {
          const item = items.get(result.id);
          if (!item) return null;
          const chosen = result.chosenKey
            ? item.choices.find((choice) => choice.key === result.chosenKey)
            : undefined;
          const correct = item.choices.find((choice) => choice.correct);
          return (
            <Card key={result.id} as="article" aria-labelledby={`missed-${result.id}`} padding="lg">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 id={`missed-${result.id}`} className="ui m-0 text-sm font-semibold text-ink">
                  Question {result.index + 1}
                </h3>
                <Link href={item.href} className="mono text-2xs">
                  {item.id}
                </Link>
                <span className="text-xs text-ink-3">{item.groups[0]?.name}</span>
              </div>
              <p className="statement prose-measure mt-3 mb-0 text-ink">
                <RichText text={item.statement} math={item.math} />
              </p>
              {item.figure ? (
                <FigureRenderer figure={item.figure} problemId={`r-${item.id}`} />
              ) : null}
              <p className="mt-3 mb-0 text-sm text-ink">
                {chosen ? (
                  <>
                    Your answer: <span className="mono font-semibold">{chosen.key}</span>{' '}
                    <span className="text-ink-2">
                      (<RichText text={chosen.text} math={item.math} />)
                    </span>
                  </>
                ) : (
                  'You left this blank.'
                )}{' '}
                Correct answer: <span className="mono font-semibold">{correct?.key}</span>{' '}
                <span className="text-ink-2">
                  (<RichText text={correct?.text ?? ''} math={item.math} />)
                </span>
              </p>
              {chosen?.misconception ? (
                <div className="mt-3 rounded-sm border border-wrong-border bg-wrong-100 p-3">
                  <p className="m-0 text-sm font-semibold text-ink">
                    The thinking that leads to {chosen.key}:
                  </p>
                  <blockquote className="reading mt-2 mb-0 border-l-2 border-wrong-border pl-3 text-ink">
                    “<RichText text={chosen.misconception} math={item.math} />”
                  </blockquote>
                </div>
              ) : null}
              <SolutionTabs
                reliable={item.solutions.reliable}
                elegant={item.solutions.elegant}
                math={item.math}
              />
            </Card>
          );
        })}
      </section>

      <details className="rounded-control border border-rule bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Every question, with the answer
        </summary>
        <ol className="m-0 mt-3 grid list-none gap-2 p-0">
          {report.questions.map((result) => (
            <li key={result.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="mono text-2xs text-ink-3">{result.index + 1}</span>
              <Link href={items.get(result.id)?.href ?? '#'} className="mono text-xs">
                {result.id}
              </Link>
              <span
                className={
                  result.outcome === 'correct'
                    ? 'text-correct-700'
                    : result.outcome === 'wrong'
                      ? 'text-wrong-700'
                      : 'text-ink-2'
                }
              >
                {result.outcome === 'correct'
                  ? 'right'
                  : result.outcome === 'wrong'
                    ? `wrong (you chose ${result.chosenKey})`
                    : 'blank'}
              </span>
              <span className="text-ink-2">answer {result.correctKey}</span>
              <span className="mono ml-auto text-2xs text-ink-3">
                {Math.round(result.msSpent / 1000)}s
              </span>
            </li>
          ))}
        </ol>
      </details>

      <div className="flex flex-wrap gap-3 border-t border-rule pt-6">{actions}</div>
    </div>
  );
});
