'use client';

import Link from '@/components/AppLink';
import { useProgress } from '@/components/mastery/useProgress';
import { examById, examColorVar } from '@/lib/exams';
import { sessionsOf, type ProgressFile, type SessionRecord } from '@/lib/local-progress';

export interface ExamScoreChartProps {
  examId: string;
  /** Section id -> display name, for section tests in the table. */
  sectionNames: Readonly<Record<string, string>>;
  /** For tests: a fixed file instead of this browser's. */
  file?: ProgressFile;
}

/** The newest sittings drawn; the table below lists every one kept. */
export const CHART_MAX_POINTS = 20;

const W = 400;
const H = 150;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 12;

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function points(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function percentOf(session: SessionRecord): number {
  return session.max > 0 ? Math.max(0, Math.min(1, session.score / session.max)) : 0;
}

/**
 * Score over time on an exam page (docs/08 item 3): every finished mock and section test for
 * this exam, as a percentage of the best possible score, in the order they were taken. Hand
 * SVG in the exam's colour; full mocks are circles and section tests squares, so the kind is
 * never carried by colour. The chart is role="img" with a one-sentence summary, and a table
 * with every score sits under it as the text alternative. Empty state when there is nothing.
 */
export function ExamScoreChart({ examId, sectionNames, file }: ExamScoreChartProps) {
  const stored = useProgress();
  const progress = file ?? stored;
  const exam = examById(examId);
  const sessions = exam?.sessionExam ? sessionsOf(progress, { exam: exam.sessionExam }) : [];

  if (!exam) return null;

  if (sessions.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-2">
        No tests yet. Your scores will appear here after you finish a{' '}
        {exam.routes.mock ? <Link href={exam.routes.mock}>mock test</Link> : 'mock test'} or a
        section test, saved in this browser.
      </p>
    );
  }

  const shown = sessions.slice(-CHART_MAX_POINTS);
  const bottom = H - PAD_B;
  const yOf = (fraction: number) => PAD_T + (1 - fraction) * (bottom - PAD_T);
  const step = shown.length > 1 ? (W - PAD_L - PAD_R) / (shown.length - 1) : 0;
  const xOf = (index: number) =>
    shown.length > 1 ? PAD_L + step * index : (PAD_L + W - PAD_R) / 2;
  const coords = shown.map((session, index) => ({
    session,
    x: xOf(index),
    y: yOf(percentOf(session)),
  }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ');
  const color = examColorVar(exam);
  const first = shown[0];
  const last = shown.at(-1);
  const summary =
    first && last
      ? `${exam.name} scores, ${shown.length} ${shown.length === 1 ? 'test' : 'tests'} in the order taken, ` +
        `from ${Math.round(percentOf(first) * 100)}% to ${Math.round(percentOf(last) * 100)}% of the best possible score.`
      : `${exam.name} scores.`;

  return (
    <div className="grid gap-3">
      <figure className="m-0 min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={summary}
          className="block"
        >
          {[1, 0.5, 0].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className={tick === 0 ? 'stroke-rule-strong' : 'stroke-grid'}
                strokeWidth={1}
              />
              <text
                x={PAD_L - 6}
                y={yOf(tick) + 4}
                textAnchor="end"
                fontSize={13}
                className="fill-ink-3"
              >
                {tick * 100}%
              </text>
            </g>
          ))}
          {coords.length > 1 ? (
            <path
              d={line}
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: color }}
            />
          ) : null}
          {coords.map(({ session, x, y }) =>
            session.kind === 'mock' ? (
              <circle
                key={`${session.kind}|${session.at}`}
                cx={x}
                cy={y}
                r={5}
                strokeWidth={2.5}
                className="fill-surface"
                style={{ stroke: color }}
              />
            ) : (
              <rect
                key={`${session.kind}|${session.at}`}
                x={x - 4.5}
                y={y - 4.5}
                width={9}
                height={9}
                strokeWidth={2.5}
                className="fill-surface"
                style={{ stroke: color }}
              />
            ),
          )}
        </svg>
        <figcaption className="ui mt-1 text-xs text-ink-3">
          Percent of the best possible score, oldest on the left. Circles are full mocks, squares
          section tests.
        </figcaption>
      </figure>
      <details className="text-sm">
        <summary className="ui cursor-pointer text-sm font-medium text-ink-2">
          Show the scores as a table
        </summary>
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="visually-hidden">Every {exam.name} test, newest first</caption>
          <thead>
            <tr className="ui border-b border-rule text-left text-xs text-ink-2">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Date
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Test
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {[...sessions].reverse().map((session) => (
              <tr key={`${session.kind}|${session.at}`} className="border-b border-rule">
                <td className="py-1.5 pr-3 text-ink-2">{dateLabel(session.at)}</td>
                <td className="py-1.5 pr-3 text-ink">
                  {session.kind === 'mock'
                    ? 'Full mock'
                    : `Section test${session.section ? `: ${sectionNames[session.section] ?? session.section}` : ''}`}
                </td>
                <td className="py-1.5 text-right text-ink tabular-nums">
                  {points(session.score)} of {points(session.max)} (
                  {Math.round(percentOf(session) * 100)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
