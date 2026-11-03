'use client';

import Link from 'next/link';
import type { Problem } from '@/lib/schemas';
import type { MockReport } from '@/lib/mock';
import { DifficultyPill } from '@/components/DifficultyPill';

/**
 * The post-exam report.
 *
 * The score is the least interesting number on the page and is treated that way. What a student
 * can act on is where the points bled out: which tier, which skills, and whether time was spent
 * on questions that were going to be wrong anyway. The scatter is the picture of that last one.
 */
export function MockReportView({
  report,
  skillNames,
  problemsById,
}: {
  report: MockReport;
  skillNames: Record<string, string>;
  problemsById: Map<string, Problem>;
}) {
  const maxSeconds = Math.max(60, ...report.scatter.map((point) => point.seconds));
  const width = 320;
  const height = 180;
  const pad = 26;

  return (
    <div>
      <h2 className="m-0 text-lg">Your paper</h2>
      <p className="mt-2 mb-6 text-2xl font-semibold text-ink tabular-nums">
        {report.score}
        <span className="text-base font-normal text-ink-3"> / {report.maxScore}</span>
      </p>

      {/*
        A scoring summary, not answer feedback: the reserved red belongs to a wrong choice, not
        to an empty one. Strong neutral instead (docs/05 §2).
      */}
      {report.blanks > 0 ? (
        <div className="mb-6 rounded-sm border-2 border-rule-strong bg-surface-3 p-3">
          <p className="m-0 text-sm text-ink">
            You left <strong>{report.blanks}</strong> blank, worth {report.blankCost} points. A
            wrong answer costs nothing here, so every one of those was a guaranteed zero where a
            guess was free. On a five-choice paper, guessing them all would have been worth about{' '}
            {Math.round(report.blankCost / 5)} points on average.
          </p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-ink-2">
          No blanks. That is the single easiest thing to get right on this paper, and you did.
        </p>
      )}

      <h3 className="m-0 text-base">By point tier</h3>
      <ul className="mt-3 grid list-none gap-2 p-0">
        {report.tiers.map((tier) => (
          <li
            key={tier.points}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2"
          >
            <DifficultyPill points={tier.points} />
            <span className="flex-1 text-sm text-ink">
              {tier.correct} of {tier.asked} right
            </span>
            {tier.blank > 0 ? <span className="text-xs text-ink-3">{tier.blank} blank</span> : null}
            <span className="mono text-2xs text-ink-2">{tier.scored} pts</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-base">Where the time went</h3>
      <p className="mt-1 mb-3 text-sm text-ink-3">
        Each mark is one question: how long you spent on it, and whether you got it right. A cluster
        of long, wrong marks on the right is where the points bled out.
      </p>
      <div className="overflow-x-auto rounded-sm border border-rule bg-surface p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Time against outcome. ${report.scatter.filter((p) => p.correct).length} correct and ${report.scatter.filter((p) => !p.correct).length} not, plotted by seconds spent.`}
        >
          <line
            x1={pad}
            y1={height - pad}
            x2={width - 6}
            y2={height - pad}
            className="stroke-rule-strong"
            strokeWidth={1}
          />
          <line
            x1={pad}
            y1={8}
            x2={pad}
            y2={height - pad}
            className="stroke-rule-strong"
            strokeWidth={1}
          />
          <text
            x={width / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-ink-3"
            fontSize={9}
          >
            seconds spent
          </text>
          <text x={8} y={24} className="fill-ink-3" fontSize={9}>
            right
          </text>
          <text x={8} y={height - pad - 6} className="fill-ink-3" fontSize={9}>
            wrong
          </text>
          {report.scatter.map((point, index) => {
            const x = pad + (point.seconds / maxSeconds) * (width - pad - 12);
            // Two bands, jittered by index so identical points do not hide each other.
            const base = point.correct ? 34 : height - pad - 34;
            const y = base + ((index % 7) - 3) * 5;
            return (
              /*
                Correct and incorrect, which is exactly what the reserved colours are for. The
                SHAPE differs too - a disc for a solve, a cross for a miss - because a scatter
                plot separated only by hue is unreadable to a colour-blind student and prints
                as one cloud of grey.
              */
              point.correct ? (
                <circle
                  key={point.problemId}
                  cx={x}
                  cy={y}
                  r={4}
                  className="fill-correct-600"
                  opacity={0.85}
                />
              ) : (
                <path
                  key={point.problemId}
                  d={`M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`}
                  className="stroke-wrong-600"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )
            );
          })}
        </svg>
      </div>
      <p className="mt-2 mb-0 flex flex-wrap gap-x-4 text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4" className="fill-correct-600" />
          </svg>
          Correct
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 1 L9 9 M9 1 L1 9"
              className="stroke-wrong-600"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Not correct
        </span>
      </p>

      <h3 className="mt-8 text-base">The three to fix first</h3>
      {report.topFixes.length === 0 ? (
        <p className="mt-2 mb-0 text-ink-2">
          Nothing came out wrong. Try the next level up, or a longer run at the 5-point block.
        </p>
      ) : (
        <ol className="mt-3 grid list-none gap-2 p-0">
          {report.topFixes.map((skillId, index) => {
            const heat = report.skills.find((entry) => entry.skillId === skillId);
            return (
              <li key={skillId}>
                <Link
                  href={`/skill/${skillId}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-strong"
                >
                  <span className="mono text-2xs text-ink-3">{index + 1}</span>
                  <span className="mono text-2xs text-ink-3">{skillId}</span>
                  <span className="flex-1 text-sm text-ink">{skillNames[skillId] ?? skillId}</span>
                  {heat ? (
                    <span className="mono text-2xs text-ink-2">
                      {heat.correct} / {heat.asked}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <details className="mt-8 rounded-sm border border-rule bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Every question, with the answer
        </summary>
        <ol className="m-0 mt-3 grid list-none gap-2 p-0">
          {report.scatter.map((point, index) => {
            const problem = problemsById.get(point.problemId);
            const correct = problem?.choices.find((choice) => choice.correct);
            return (
              <li key={point.problemId} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="mono text-2xs text-ink-3">{index + 1}</span>
                <Link href={`/problem/${point.problemId}`} className="mono text-xs">
                  {point.problemId}
                </Link>
                <DifficultyPill points={point.points} />
                <span className={point.correct ? 'text-correct-700' : 'text-wrong-700'}>
                  {point.correct ? 'right' : 'wrong'}
                </span>
                <span className="text-ink-2">answer {correct?.key}</span>
                <span className="mono ml-auto text-2xs text-ink-3">{point.seconds}s</span>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
