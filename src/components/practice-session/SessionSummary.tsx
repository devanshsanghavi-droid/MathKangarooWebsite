import Link from '@/components/AppLink';
import { Button, ButtonLink, Card, ProgressBar } from '@/components/ui';
import { practiceSetHref, type PracticeBank, type PracticeItem } from '@/lib/practice-item';
import {
  OUTCOME_LABEL,
  outcomeOf,
  spokenDuration,
  formatClock,
  type QuestionOutcome,
  type SessionState,
  type SessionSummary as Summary,
} from './session-state';

/**
 * The end of a set (docs/06 §4): the score, the time, a bar per skill (or AMC topic), and the
 * two ways on: "Review missed" as a new set of exactly the missed ids, and back to the bank.
 *
 * Outcomes are words plus a neutral glyph, never green and red: this is a standing record of
 * the set, not the moment of answering, and the reserved colours belong to that moment.
 */

const OUTCOME_GLYPH: Record<QuestionOutcome, string> = {
  'first-try': '✓',
  'after-miss': '↻',
  missed: '✗',
  unanswered: '○',
};

export function SessionSummary({
  bank,
  items,
  state,
  summary,
  seconds,
  exitHref,
  exitLabel,
  missing,
  onResume,
}: {
  bank: PracticeBank;
  items: readonly PracticeItem[];
  state: SessionState;
  summary: Summary;
  seconds: number;
  exitHref: string;
  exitLabel: string;
  missing: readonly string[];
  onResume: (index?: number) => void;
}) {
  const { correct, total, unanswered, missedIds, groups } = summary;

  return (
    <div className="grid gap-4">
      <Card padding="lg">
        <h2 id="session-summary" tabIndex={-1} className="m-0 text-xl focus:outline-none">
          Set complete
        </h2>
        <dl className="ui m-0 mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-2">Right first time</dt>
            <dd className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums">
              {correct}
              <span className="text-lg text-ink-3"> / {total}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Time</dt>
            <dd className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums">
              <span aria-hidden="true">{formatClock(seconds)}</span>
              <span className="visually-hidden">{spokenDuration(seconds)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Not answered</dt>
            <dd className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums">{unanswered}</dd>
          </div>
        </dl>
        <ProgressBar
          className="mt-5"
          size="md"
          value={correct}
          max={total}
          label="This set"
          unit="right first time"
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {missedIds.length > 0 ? (
            <ButtonLink
              variant="primary"
              href={practiceSetHref({ bank, ids: missedIds, name: 'Review missed' })}
            >
              Review missed ({missedIds.length})
            </ButtonLink>
          ) : null}
          <ButtonLink href={exitHref} variant={missedIds.length > 0 ? 'secondary' : 'primary'}>
            {exitLabel}
          </ButtonLink>
          {unanswered > 0 ? (
            <Button variant="ghost" onClick={() => onResume()}>
              Back to the questions
            </Button>
          ) : null}
        </div>
        {missing.length > 0 ? (
          <p className="ui m-0 mt-4 text-xs text-ink-3">
            {missing.length === 1 ? 'One question' : `${missing.length} questions`} from the link
            could not be found and {missing.length === 1 ? 'was' : 'were'} left out.
          </p>
        ) : null}
      </Card>

      {groups.length > 0 ? (
        <Card as="section" aria-labelledby="summary-groups">
          <h3 id="summary-groups" className="ui m-0 text-base font-semibold text-ink">
            {bank === 'amc' ? 'By topic' : 'By skill'}
          </h3>
          <ul className="m-0 mt-4 grid list-none gap-4 p-0 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id}>
                <ProgressBar
                  value={group.correct}
                  max={group.total}
                  label={group.name}
                  unit="right first time"
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="summary-questions" padding="none">
        <h3 id="summary-questions" className="ui m-0 px-4 pt-4 text-base font-semibold text-ink">
          Question by question
        </h3>
        <ol className="m-0 mt-2 list-none p-0">
          {items.map((item, index) => {
            const question = state.questions[index];
            const outcome = question ? outcomeOf(question) : 'unanswered';
            return (
              <li
                key={item.id}
                className="ui flex items-center gap-3 border-t border-rule px-4 py-2.5 text-sm"
              >
                <span className="w-6 shrink-0 text-right text-ink-3 tabular-nums">{index + 1}</span>
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-rule-strong text-xs text-ink"
                >
                  {OUTCOME_GLYPH[outcome]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{OUTCOME_LABEL[outcome]}</span>
                  <span className="ml-2 text-xs text-ink-3">{item.groups[0]?.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onResume(index)}
                  className="cursor-pointer rounded-control px-2 py-1 text-xs font-semibold text-accent-700 hover:bg-surface-2"
                >
                  Look again<span className="visually-hidden"> at question {index + 1}</span>
                </button>
                <Link
                  href={item.href}
                  className="mono text-2xs text-ink-2 no-underline hover:underline"
                >
                  {item.id}
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
