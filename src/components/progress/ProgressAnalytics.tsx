'use client';

import { useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import Link from '@/components/AppLink';
import { useProgress } from '@/components/mastery/useProgress';
import { ButtonLink, Panel, ProgressBar, StatTile, cx } from '@/components/ui';
import { readSignedInHint } from '@/lib/signed-in-hint';
import type { ProgressFile, SessionExam, SessionRecord } from '@/lib/local-progress';
import {
  BANK_MOCK_HREF,
  NEEDS_PRACTICE_MIN_ATTEMPTS,
  PROGRESS_BANK_LABEL,
  PROGRESS_SECTION_NOUN,
  bankSummary,
  percentLabel,
  sectionTestHref,
  trendOf,
  type BankSpec,
  type BankSummary,
  type ProgressBank,
  type SectionStat,
} from '@/lib/progress-analytics';
import { WeeklyChart } from './WeeklyChart';

/**
 * /progress (docs/07 section 5). Reads the progress file in this browser, which ProgressSync
 * keeps in step with the account copy when the student is signed in, so the page is the same
 * static HTML for everyone and the numbers appear after hydration.
 *
 * Only the student's own numbers. No streak, no badge, no comparison with anyone else.
 */

const noop = () => () => {};

const EXAM_LABEL: Readonly<Record<SessionExam, string>> = {
  KA: 'Kangaroo',
  AMC8: 'AMC 8',
  AMC10: 'AMC 10',
  AMC12: 'AMC 12',
  SAT: 'SAT',
  ACT: 'ACT',
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function durationLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? 'under a minute' : plural(minutes, 'min', 'min');
}

export interface ProgressAnalyticsProps {
  banks: readonly BankSpec[];
  /** For tests: a fixed clock and file. The page leaves both out. */
  now?: Date;
  file?: ProgressFile;
}

export function ProgressAnalytics({ banks, now, file }: ProgressAnalyticsProps) {
  const stored = useProgress();
  const progress = file ?? stored;
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const signedIn = useSyncExternalStore(noop, readSignedInHint, () => false);

  const summaries = useMemo(() => {
    const clock = now ?? new Date();
    return banks.map((spec) => ({ spec, summary: bankSummary(progress, spec, clock) }));
  }, [banks, progress, now]);

  const firstActive = summaries.find((s) => s.summary.active)?.spec.bank;
  const [chosen, setChosen] = useState<ProgressBank | null>(null);
  const selected =
    chosen && summaries.some((s) => s.spec.bank === chosen && s.summary.active)
      ? chosen
      : firstActive;

  if (!hydrated && !file) {
    return (
      <p className="ui m-0 text-sm text-ink-3" role="status">
        Loading your progress from this browser.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {signedIn ? (
        <p className="ui m-0 text-sm text-ink-2">
          Synced with your account, so this is the same on every device you sign in on.
        </p>
      ) : (
        <p className="ui m-0 text-sm text-ink-2">
          This is saved in this browser only.{' '}
          <Link href="/login">Sign in to keep this on every device</Link>.
        </p>
      )}

      {firstActive === undefined ? (
        <EmptyProgress />
      ) : (
        <BankTabs
          summaries={summaries}
          selected={selected ?? firstActive}
          onSelect={(bank) => setChosen(bank)}
        />
      )}
    </div>
  );
}

function EmptyProgress() {
  return (
    <Panel title="Nothing here yet">
      <p className="m-0 max-w-prose text-ink-2">
        Answer a few questions and this page fills in: how you are doing in each section, which
        sections are worth more practice, and how the last twelve weeks have gone. Nothing is needed
        to start, not even an account.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/" variant="primary">
          Start a practice set
        </ButtonLink>
        <ButtonLink href="/problems" variant="secondary">
          Browse the question bank
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The WAI-ARIA tabs pattern, like ui/Tabs, plus disabled tabs: a bank with nothing in it stays
 * visible (so the student knows it exists) but is aria-disabled and skipped by the arrow keys.
 */
function BankTabs({
  summaries,
  selected,
  onSelect,
}: {
  summaries: ReadonlyArray<{ spec: BankSpec; summary: BankSummary }>;
  selected: ProgressBank;
  onSelect: (bank: ProgressBank) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const current = summaries.find((s) => s.spec.bank === selected);
  const activeIndexes = summaries.flatMap((s, i) => (s.summary.active ? [i] : []));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = activeIndexes.indexOf(summaries.findIndex((s) => s.spec.bank === selected));
    const last = activeIndexes.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = at >= last ? 0 : at + 1;
    else if (event.key === 'ArrowLeft') next = at <= 0 ? last : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    const index = activeIndexes[next];
    const target = index === undefined ? undefined : summaries[index];
    if (!target || index === undefined) return;
    onSelect(target.spec.bank);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }

  return (
    <div className="ui">
      <div
        ref={list}
        role="tablist"
        aria-label="Question bank"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-rule"
      >
        {summaries.map(({ spec, summary }) => {
          const isSelected = spec.bank === selected;
          const disabled = !summary.active;
          return (
            <button
              key={spec.bank}
              id={`progress-tab-${spec.bank}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={isSelected ? 'progress-panel' : undefined}
              aria-disabled={disabled || undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                if (!disabled) onSelect(spec.bank);
              }}
              className={cx(
                '-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap',
                isSelected
                  ? 'cursor-pointer border-accent-600 font-semibold text-ink'
                  : disabled
                    ? 'cursor-not-allowed border-transparent text-ink-3'
                    : 'cursor-pointer border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {PROGRESS_BANK_LABEL[spec.bank]}
              {disabled ? (
                <span className="text-2xs text-ink-3">
                  <span aria-hidden="true">(none yet)</span>
                  <span className="visually-hidden">, nothing answered yet</span>
                </span>
              ) : (
                <span className="mono text-2xs text-ink-3 tabular-nums">
                  {summary.attempts}
                  <span className="visually-hidden"> answered</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current ? (
        <div
          id="progress-panel"
          role="tabpanel"
          aria-labelledby={`progress-tab-${current.spec.bank}`}
          tabIndex={0}
          className="pt-5"
        >
          <BankPanel spec={current.spec} summary={current.summary} />
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One bank                                                                    */
/* -------------------------------------------------------------------------- */

function BankPanel({ spec, summary }: { spec: BankSpec; summary: BankSummary }) {
  const noun = PROGRESS_SECTION_NOUN[spec.bank];
  const trend = trendOf(summary.weeks);
  const label = PROGRESS_BANK_LABEL[spec.bank];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile value={summary.attempts} label="Answered" detail="retries included" />
        <StatTile
          value={percentLabel(summary.accuracy)}
          label="Accuracy"
          detail={`${summary.correct} right`}
        />
        <StatTile
          value={summary.sectionsTried}
          label={`${noun.section}s tried`}
          detail={`of ${summary.sections.length}`}
        />
        <StatTile
          value={summary.sessions.length}
          label="Tests taken"
          detail="mocks and section tests"
        />
      </div>

      <NeedsPractice bank={spec.bank} items={summary.needsPractice} noun={noun.section} />

      <Panel
        title={`By ${noun.section}`}
        description={`Share of answers right in each ${noun.section}. Open one to see each ${noun.sub}.`}
      >
        <BySection sections={summary.sections} subNoun={noun.sub} />
      </Panel>

      <Panel title="Over time" description="The last twelve weeks, Monday to Sunday.">
        {trend.change !== null ? (
          <p className="ui m-0 mb-4 text-sm text-ink-2">
            Accuracy over the last four weeks was {percentLabel(trend.recent.accuracy)}, against{' '}
            {percentLabel(trend.earlier.accuracy)} in the four weeks before.
          </p>
        ) : null}
        <WeeklyChart weeks={summary.weeks} />
      </Panel>

      <Panel
        title="Test history"
        description="Mocks and section tests you finished, newest first."
        actions={
          <ButtonLink href={BANK_MOCK_HREF[spec.bank]} variant="secondary" size="sm">
            Take a {label} mock
          </ButtonLink>
        }
      >
        <TestHistory sessions={summary.sessions} spec={spec} />
      </Panel>
    </div>
  );
}

function NeedsPractice({
  bank,
  items,
  noun,
}: {
  bank: ProgressBank;
  items: readonly SectionStat[];
  noun: string;
}) {
  return (
    <Panel
      title="Worth more practice"
      description={`Your lowest-accuracy ${noun}s with at least ${NEEDS_PRACTICE_MIN_ATTEMPTS} answers.`}
    >
      {items.length === 0 ? (
        <p className="m-0 text-sm text-ink-2">
          Nothing to flag yet. Once a {noun} has {NEEDS_PRACTICE_MIN_ATTEMPTS} answers and some of
          them are wrong, it shows up here with a short test to work on it.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control border border-rule bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-semibold text-ink">{item.name}</p>
                <p className="m-0 text-xs text-ink-2">
                  {percentLabel(item.accuracy)} right, {item.correct} of {item.attempts}
                </p>
              </div>
              <ButtonLink href={sectionTestHref(bank, item)} variant="primary" size="sm">
                Practice this<span className="visually-hidden">: {item.name}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BySection({ sections, subNoun }: { sections: readonly SectionStat[]; subNoun: string }) {
  const tried = sections.filter((s) => s.attempts > 0);
  const untried = sections.filter((s) => s.attempts === 0);
  return (
    <div className="grid gap-3">
      <ul className="m-0 grid list-none gap-3 p-0">
        {tried.map((section) => {
          const subs = section.subs.filter((s) => s.attempts > 0);
          return (
            <li key={section.id} className="rounded-control border border-rule px-3 py-2">
              <ProgressBar
                value={section.correct}
                max={section.attempts}
                label={section.name}
                unit="right"
                size="md"
                numbers={`${percentLabel(section.accuracy)} · ${section.correct} / ${section.attempts}`}
              />
              {subs.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-accent-700">
                    {plural(subs.length, subNoun)} answered in {section.name}
                  </summary>
                  <ul className="m-0 mt-2 grid list-none gap-2 p-0 pl-3">
                    {subs.map((sub) => (
                      <li key={sub.id}>
                        <ProgressBar
                          value={sub.correct}
                          max={sub.attempts}
                          label={sub.name}
                          unit="right"
                          numbers={`${percentLabel(sub.accuracy)} · ${sub.correct} / ${sub.attempts}`}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      {untried.length > 0 ? (
        <p className="m-0 text-xs text-ink-3">
          Not tried yet: {untried.map((s) => s.name).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

function TestHistory({ sessions, spec }: { sessions: readonly SessionRecord[]; spec: BankSpec }) {
  if (sessions.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-2">
        No finished tests yet. A mock or a section test you finish is listed here with its score.
      </p>
    );
  }
  const sectionName = new Map(spec.sections.map((s) => [s.id, s.name]));
  return (
    // At 360px the table can be wider than the panel. The wrapper takes focus so a keyboard
    // user can scroll it with the arrow keys (WCAG 2.1.1).
    <div className="overflow-x-auto" role="region" aria-label="Finished tests table" tabIndex={0}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="visually-hidden">Finished tests, newest first</caption>
        <thead>
          <tr className="border-b border-rule text-xs text-ink-2">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Date
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Test
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Score
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Right
            </th>
            <th scope="col" className="py-2 font-semibold">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={`${s.kind}|${s.exam}|${s.at}`} className="border-b border-rule align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{dateLabel(s.at)}</td>
              <td className="py-2 pr-3 text-ink">
                {EXAM_LABEL[s.exam]} {s.kind === 'mock' ? 'mock' : 'section test'}
                {s.section ? (
                  <span className="block text-xs text-ink-3">
                    {sectionName.get(s.section) ?? s.section}
                  </span>
                ) : null}
              </td>
              <td className="mono py-2 pr-3 whitespace-nowrap text-ink tabular-nums">
                {s.score} / {s.max}
              </td>
              <td className="mono py-2 pr-3 whitespace-nowrap text-ink-2 tabular-nums">
                {s.correct} / {s.total}
              </td>
              <td className="py-2 whitespace-nowrap text-ink-2">{durationLabel(s.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
