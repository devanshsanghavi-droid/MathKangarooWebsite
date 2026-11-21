import { percentLabel, type WeekStat } from '@/lib/progress-analytics';

/**
 * The "over time" block of /progress: weekly accuracy as a line and weekly answers as bars,
 * last eight (or twelve) weeks, hand-drawn SVG coloured only through tokens.
 *
 * Both charts are role="img" with a sentence naming what they show, and the same numbers sit
 * in a visually hidden table for a screen reader, which reads a table far better than a path.
 * A week with no answers leaves a gap in the line rather than dropping to zero.
 *
 * The bars are --accent-600, not the decorative --sky-500: they carry data, so they need 3:1
 * against the surface (WCAG 1.4.11), and sky-500 is about 2.4:1 on white. Axis labels are
 * 13 units so they stay legible when the 400-unit chart shrinks to a 360px phone.
 */

const W = 400;
const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 10;

function weekLabel(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** A round axis top: 5, 10, 20, 50, 100... */
export function niceMax(value: number): number {
  if (value <= 5) return 5;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (value <= step * power) return step * power;
  return 10 * power;
}

function xOf(index: number, count: number): number {
  const step = (W - PAD_L - PAD_R) / count;
  return PAD_L + step * (index + 0.5);
}

function AccuracyChart({ weeks }: { weeks: readonly WeekStat[] }) {
  const h = 130;
  const bottom = h - 12;
  const yOf = (accuracy: number) => PAD_T + (1 - accuracy) * (bottom - PAD_T);
  const points = weeks.map((w, i) =>
    w.accuracy === null ? null : { x: xOf(i, weeks.length), y: yOf(w.accuracy) },
  );
  const segments: string[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (p && prev) segments.push(`M${prev.x} ${prev.y} L${p.x} ${p.y}`);
  });
  const shown = weeks.filter((w) => w.accuracy !== null);
  const last = shown.at(-1);
  const label =
    shown.length === 0
      ? `Weekly accuracy, last ${weeks.length} weeks: no answers yet.`
      : `Weekly accuracy, last ${weeks.length} weeks. ${shown.length} weeks with answers, from ${percentLabel(
          shown[0]?.accuracy ?? null,
        )} to ${percentLabel(last?.accuracy ?? null)} in the most recent.`;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label={label} className="block">
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
      {segments.map((d) => (
        <path
          key={d}
          d={d}
          className="stroke-accent-600"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      {points.map((p, i) =>
        p ? (
          <circle
            key={weeks[i]?.start}
            cx={p.x}
            cy={p.y}
            r={4}
            className="fill-surface stroke-accent-600"
            strokeWidth={2}
          />
        ) : null,
      )}
    </svg>
  );
}

function AnsweredChart({ weeks }: { weeks: readonly WeekStat[] }) {
  const h = 110;
  const bottom = h - 12;
  const top = niceMax(Math.max(0, ...weeks.map((w) => w.attempts)));
  const yOf = (count: number) => PAD_T + (1 - count / top) * (bottom - PAD_T);
  const step = (W - PAD_L - PAD_R) / weeks.length;
  const barWidth = Math.max(4, step * 0.6);
  const total = weeks.reduce((n, w) => n + w.attempts, 0);
  const busiest = Math.max(0, ...weeks.map((w) => w.attempts));
  const label = `Questions answered each week, last ${weeks.length} weeks: ${total} in all, at most ${busiest} in one week.`;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label={label} className="block">
      {[top, top / 2, 0].map((tick) => (
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
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      ))}
      {weeks.map((w, i) =>
        w.attempts > 0 ? (
          <rect
            key={w.start}
            x={xOf(i, weeks.length) - barWidth / 2}
            y={yOf(w.attempts)}
            width={barWidth}
            height={Math.max(1, bottom - yOf(w.attempts))}
            rx={2}
            className="fill-accent-600"
          />
        ) : null,
      )}
    </svg>
  );
}

function AxisDates({ weeks }: { weeks: readonly WeekStat[] }) {
  const first = weeks[0];
  return (
    <div
      aria-hidden="true"
      className="mono mt-1 flex justify-between gap-2 text-2xs text-ink-3"
      style={{ paddingLeft: `${(PAD_L / W) * 100}%` }}
    >
      <span>Week of {first ? weekLabel(first.start) : ''}</span>
      <span>This week</span>
    </div>
  );
}

export function WeeklyChart({ weeks }: { weeks: readonly WeekStat[] }) {
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <figure className="m-0 min-w-0">
          <figcaption className="ui mb-2 text-sm font-semibold text-ink">Accuracy</figcaption>
          <AccuracyChart weeks={weeks} />
          <AxisDates weeks={weeks} />
        </figure>
        <figure className="m-0 min-w-0">
          <figcaption className="ui mb-2 text-sm font-semibold text-ink">
            Questions answered
          </figcaption>
          <AnsweredChart weeks={weeks} />
          <AxisDates weeks={weeks} />
        </figure>
      </div>
      <table className="visually-hidden">
        <caption>Week by week, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Answered</th>
            <th scope="col">Right</th>
            <th scope="col">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">{weekLabel(w.start)}</th>
              <td>{w.attempts}</td>
              <td>{w.correct}</td>
              <td>{w.accuracy === null ? 'no answers' : percentLabel(w.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
