import { examForSession, examColorVar } from '@/lib/exams';
import {
  SESSION_EXAM_LABEL,
  percentLabel,
  sessionLabel,
  type ScoreSeries,
} from '@/lib/progress-analytics';

/**
 * Mock and section test scores over time (docs/08 item 8): one line per exam in that exam's
 * colour, each point a finished test as a share of its top score, so a 25-question AMC 8 and
 * a 120-point Kangaroo paper share one axis. A full mock is a filled dot, a section test a
 * hollow square, so the kind never rests on colour; the legend names each exam in words.
 *
 * role="img" with a one-sentence summary, and every point in a visually hidden table.
 */

const W = 400;
const H = 170;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 10;
const BOTTOM = H - 14;

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function colorOf(exam: ScoreSeries['exam']): string {
  const entry = examForSession(exam);
  return entry ? examColorVar(entry) : 'var(--ink-2)';
}

export function ScoreChart({ series }: { series: readonly ScoreSeries[] }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-2">
        No finished tests yet. Each mock or section test you finish adds a point here.
      </p>
    );
  }
  const times = all.map((p) => Date.parse(p.at));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const xOf = (iso: string) =>
    t1 === t0
      ? (PAD_L + W - PAD_R) / 2
      : PAD_L + ((Date.parse(iso) - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
  const yOf = (ratio: number) => PAD_T + (1 - ratio) * (BOTTOM - PAD_T);

  const summary = series
    .map((s) => {
      const first = s.points[0];
      const last = s.points.at(-1);
      if (!first || !last) return '';
      return s.points.length === 1
        ? `${SESSION_EXAM_LABEL[s.exam]}: one test, ${percentLabel(first.ratio)}`
        : `${SESSION_EXAM_LABEL[s.exam]}: ${s.points.length} tests, from ${percentLabel(first.ratio)} to ${percentLabel(last.ratio)}`;
    })
    .filter(Boolean)
    .join('; ');
  const label = `Test scores as a share of the top score, oldest to newest. ${summary}.`;

  const sorted = [...all].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div>
      <ul className="ui m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-ink-2">
        {series.map((s) => (
          <li key={s.exam} className="inline-flex items-center gap-1.5">
            <svg width="22" height="10" aria-hidden="true" className="shrink-0">
              <line
                x1="1"
                x2="21"
                y1="5"
                y2="5"
                strokeWidth="3"
                style={{ stroke: colorOf(s.exam) }}
              />
            </svg>
            {SESSION_EXAM_LABEL[s.exam]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true" className="shrink-0">
            <circle cx="5" cy="5" r="4" className="fill-ink-2" />
          </svg>
          Mock
        </li>
        <li className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true" className="shrink-0">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              className="fill-surface stroke-ink-2"
              strokeWidth="1.5"
            />
          </svg>
          Section test
        </li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} className="block">
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
        {series.map((s) => {
          const color = colorOf(s.exam);
          const d = s.points
            .map(
              (p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.at).toFixed(1)} ${yOf(p.ratio).toFixed(1)}`,
            )
            .join(' ');
          return (
            <g key={s.exam}>
              {s.points.length > 1 ? (
                <path
                  d={d}
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: color }}
                />
              ) : null}
              {s.points.map((p) => {
                const x = xOf(p.at);
                const y = yOf(p.ratio);
                return p.session.kind === 'mock' ? (
                  <circle
                    key={`${p.session.kind}|${p.at}`}
                    cx={x}
                    cy={y}
                    r={4.5}
                    style={{ fill: color }}
                  />
                ) : (
                  <rect
                    key={`${p.session.kind}|${p.at}`}
                    x={x - 4}
                    y={y - 4}
                    width={8}
                    height={8}
                    strokeWidth={2}
                    className="fill-surface"
                    style={{ stroke: color }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div
        aria-hidden="true"
        className="mono mt-1 flex justify-between gap-2 text-2xs text-ink-3"
        style={{ paddingLeft: `${(PAD_L / W) * 100}%` }}
      >
        <span>{dateLabel(sorted[0]?.at ?? '')}</span>
        {sorted.length > 1 ? <span>{dateLabel(sorted.at(-1)?.at ?? '')}</span> : null}
      </div>
      <table className="visually-hidden">
        <caption>Test scores, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Test</th>
            <th scope="col">Score</th>
            <th scope="col">Share of top score</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={`${p.session.exam}|${p.at}`}>
              <th scope="row">{dateLabel(p.at)}</th>
              <td>{sessionLabel(p.session)}</td>
              <td>
                {p.session.score} of {p.session.max}
              </td>
              <td>{percentLabel(p.ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
