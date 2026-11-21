import { Badge, ButtonLink } from '@/components/ui';
import {
  NEEDS_PRACTICE_MIN_ATTEMPTS,
  NEEDS_WORK_BELOW,
  PROGRESS_BANK_LABEL,
  RECENT_DAYS,
  STRONG_FROM,
  TOPIC_TAG_LABEL,
  percentLabel,
  sectionTestHref,
  type PeriodComparison,
  type TopicRow,
} from '@/lib/progress-analytics';

/**
 * Strengths and weak spots (docs/08 item 8): every topic answered in, weakest first, with a
 * Practice button into that topic's section test. "Needs work" and "Strong" are written out
 * as words in a pill, so the verdict never rests on colour.
 */

export function secondsLabel(ms: number | null): string {
  if (ms === null) return '-';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export function trendLabel(trend: PeriodComparison): string {
  if (trend.change === null) return '-';
  const p = Math.round(trend.change * 100);
  if (p === 0) return 'steady';
  return p > 0 ? `up ${p} pts` : `down ${-p} pts`;
}

export function TopicTable({ rows, qualify }: { rows: readonly TopicRow[]; qualify: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-2">
        No topics answered yet. Answer a few questions and each topic appears here with its
        accuracy.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="m-0 text-xs text-ink-2">
        Tags need {NEEDS_PRACTICE_MIN_ATTEMPTS} answers: under {Math.round(NEEDS_WORK_BELOW * 100)}%
        is <q>Needs work</q>, {Math.round(STRONG_FROM * 100)}% or more is <q>Strong</q>. Trend
        compares the last {RECENT_DAYS} days with everything before, once each side has{' '}
        {NEEDS_PRACTICE_MIN_ATTEMPTS} answers.
      </p>
      {/* Wider than a phone: the wrapper scrolls and takes focus, so arrow keys reach it. */}
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Strengths and weak spots table"
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="visually-hidden">Topics, weakest first</caption>
          <thead>
            <tr className="border-b border-rule text-xs text-ink-2">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Topic
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Accuracy
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Answered
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Avg time
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Trend
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Tag
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="visually-hidden">Practice</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.bank}|${row.id}`} className="border-b border-rule align-middle">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
                  {row.name}
                  {qualify ? (
                    <span className="block text-xs font-normal text-ink-3">
                      {PROGRESS_BANK_LABEL[row.bank]}
                    </span>
                  ) : null}
                </th>
                <td className="mono py-2 pr-3 whitespace-nowrap text-ink tabular-nums">
                  {percentLabel(row.accuracy)}
                </td>
                <td className="mono py-2 pr-3 whitespace-nowrap text-ink-2 tabular-nums">
                  {row.attempts}
                </td>
                <td className="mono py-2 pr-3 whitespace-nowrap text-ink-2 tabular-nums">
                  {secondsLabel(row.averageMs)}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{trendLabel(row.trend)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {row.tag ? (
                    <Badge tone={row.tag === 'strong' ? 'accent' : 'outline'}>
                      {TOPIC_TAG_LABEL[row.tag]}
                    </Badge>
                  ) : (
                    <span className="text-ink-3">-</span>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <ButtonLink
                    href={sectionTestHref(row.bank, row)}
                    variant={row.tag === 'needs-work' ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    Practice<span className="visually-hidden">: {row.name}</span>
                  </ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
