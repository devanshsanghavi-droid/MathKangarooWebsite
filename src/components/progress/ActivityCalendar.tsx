import { activityLevel, type DayActivity } from '@/lib/progress-analytics';

/**
 * Twelve weeks of activity (docs/08 item 8): one column per week, Monday at the top, each day
 * shaded by how many questions were answered. Intensity is the accent token at four opacities,
 * and an empty day is an outlined cell, so "no practice" and "a little" never look alike.
 * Days after today are left out rather than drawn as days off.
 *
 * The cells are decoration for the sentence beside them and the hidden week-by-week table:
 * a screen reader gets the totals, not 84 squares.
 */

const CELL = 14;
const GAP = 3;
const LEFT = 26;
const TOP = 4;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const OPACITY = [0, 0.3, 0.55, 0.8, 1] as const;

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ActivityCalendar({ days }: { days: readonly DayActivity[] }) {
  const weeks: DayActivity[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const past = days.filter((d) => !d.future);
  const busiest = past.reduce<DayActivity | null>(
    (best, d) => (d.attempts > (best?.attempts ?? 0) ? d : best),
    null,
  );
  const active = past.filter((d) => d.attempts > 0).length;
  const total = past.reduce((n, d) => n + d.attempts, 0);
  const summary =
    active === 0
      ? `No questions answered in the last ${weeks.length} weeks.`
      : `Active on ${active} of the last ${past.length} days, ${total} questions in all. Busiest day: ${dayLabel(
          busiest?.date ?? '',
        )}, with ${busiest?.attempts ?? 0}.`;
  const width = LEFT + weeks.length * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);
  const max = busiest?.attempts ?? 0;

  return (
    <div>
      <p className="ui m-0 mb-3 text-sm text-ink-2">{summary}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        className="block max-w-[26rem]"
        aria-hidden="true"
      >
        {DAY_LABELS.map((label, row) =>
          label ? (
            <text
              key={label}
              x={0}
              y={TOP + row * (CELL + GAP) + CELL - 3}
              fontSize={10}
              className="fill-ink-3"
            >
              {label}
            </text>
          ) : null,
        )}
        {weeks.map((week, col) =>
          week.map((day, row) => {
            if (day.future) return null;
            const level = activityLevel(day.attempts, max);
            const x = LEFT + col * (CELL + GAP);
            const y = TOP + row * (CELL + GAP);
            return level === 0 ? (
              <rect
                key={day.date}
                x={x + 0.5}
                y={y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                rx={3}
                className="fill-surface-2 stroke-rule-strong"
                strokeWidth={1}
              />
            ) : (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={3}
                className="fill-accent-600"
                fillOpacity={OPACITY[level]}
              />
            );
          }),
        )}
      </svg>
      <div aria-hidden="true" className="ui mt-2 flex items-center gap-1.5 text-2xs text-ink-3">
        <span>None</span>
        <svg width="14" height="14">
          <rect
            x="0.5"
            y="0.5"
            width="13"
            height="13"
            rx="3"
            className="fill-surface-2 stroke-rule-strong"
          />
        </svg>
        <span className="ml-1">Fewer</span>
        {[1, 2, 3, 4].map((level) => (
          <svg key={level} width="14" height="14">
            <rect
              width="14"
              height="14"
              rx="3"
              className="fill-accent-600"
              fillOpacity={OPACITY[level as 1 | 2 | 3 | 4]}
            />
          </svg>
        ))}
        <span>More</span>
      </div>
      <table className="visually-hidden">
        <caption>Activity week by week, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Days active</th>
            <th scope="col">Questions answered</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.date}>
              <th scope="row">{dayLabel(week[0]?.date ?? '')}</th>
              <td>{week.filter((d) => d.attempts > 0).length}</td>
              <td>{week.reduce((n, d) => n + d.attempts, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
