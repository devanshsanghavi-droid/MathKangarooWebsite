'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import { useProgress } from '@/components/mastery/useProgress';
import { ButtonLink, Panel, ProgressBar, StatTile } from '@/components/ui';
import { demoProgress, isDemoSearch, type DemoKaProblem } from '@/lib/demo-progress';
import { examById, topicName } from '@/lib/exams';
import { readSignedInHint } from '@/lib/signed-in-hint';
import type { ProgressFile, SessionRecord } from '@/lib/local-progress';
import {
  EXAM_BANK,
  EXAM_FILTERS,
  PROGRESS_SECTION_NOUN,
  RECENT_DAYS,
  SESSION_BANK,
  TEST_COMPARE_COUNT,
  TEST_COMPARE_MIN,
  answeredCounts,
  compareRecent,
  compareTests,
  dailyActivity,
  examAnswers,
  examFilterCounts,
  examSessions,
  parseExamFilter,
  percentLabel,
  practiceAnswers,
  progressSentence,
  scoreSeries,
  sectionStats,
  timeStats,
  topicRows,
  weeklyStats,
  type BankSpec,
  type ExamFilter as Filter,
  type SectionStat,
} from '@/lib/progress-analytics';
import { ActivityCalendar } from './ActivityCalendar';
import { ExamFilter } from './ExamFilter';
import { ScoreChart } from './ScoreChart';
import { TestHistory } from './TestHistory';
import { TopicTable, secondsLabel } from './TopicTable';
import { WeeklyChart } from './WeeklyChart';
import { setSearchParam, useSearch } from './useSearch';

/**
 * /progress (docs/07 section 5, docs/08 items 7 and 8). Reads the progress file in this
 * browser, which ProgressSync keeps in step with the account copy when the student is signed
 * in, so the page is the same static HTML for everyone and the numbers appear after hydration.
 *
 * `?exam=` picks one exam (mirrored to the URL in place); `?demo=1` swaps in the generated
 * demo student, built in memory and handed to the same code, never written anywhere.
 *
 * Only the student's own numbers. No streak, no badge, no comparison with anyone else.
 */

const noop = () => () => {};

const ACCURACY_WEEKS = 8;
const CALENDAR_WEEKS = 12;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function timeLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface ProgressAnalyticsProps {
  banks: readonly BankSpec[];
  /** Kangaroo problems the demo student may answer (build time). */
  demoKa?: readonly DemoKaProblem[];
  /** For tests: a fixed clock and file. The page leaves both out. */
  now?: Date;
  file?: ProgressFile;
}

export function ProgressAnalytics({ banks, demoKa = [], now, file }: ProgressAnalyticsProps) {
  const stored = useProgress();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const signedIn = useSyncExternalStore(noop, readSignedInHint, () => false);
  const search = useSearch();
  const demo = isDemoSearch(search);
  const [clock] = useState(() => now ?? new Date());

  // The demo file lives only in this memo: never written to storage, so ProgressSync (which
  // reads storage) never sees it.
  const demoFile = useMemo(
    () => (demo ? demoProgress({ banks, kaProblems: demoKa, now: clock }) : null),
    [demo, banks, demoKa, clock],
  );
  const progress = demoFile ?? file ?? stored;

  const counts = useMemo(() => examFilterCounts(progress, banks), [progress, banks]);
  const asked = parseExamFilter(new URLSearchParams(search).get('exam'));
  const filter: Filter =
    counts[asked].answers + counts[asked].tests > 0 || asked === 'all' ? asked : 'all';

  if (!hydrated && !file) {
    return (
      <p className="ui m-0 text-sm text-ink-3" role="status">
        Loading your progress from this browser.
      </p>
    );
  }

  const empty = counts.all.answers + counts.all.tests === 0;

  return (
    <div className="grid gap-6">
      {demo ? (
        <DemoBanner />
      ) : signedIn ? (
        <p className="ui m-0 text-sm text-ink-2">
          Synced with your account, so this is the same on every device you sign in on.
        </p>
      ) : (
        <p className="ui m-0 text-sm text-ink-2">
          This is saved in this browser only.{' '}
          <Link href="/login">Sign in to keep this on every device</Link>.
        </p>
      )}

      {empty ? (
        <EmptyProgress />
      ) : (
        <>
          <ExamFilter
            options={EXAM_FILTERS.map((value) => ({ value, ...counts[value] }))}
            value={filter}
            onChange={(next) => setSearchParam('exam', next === 'all' ? null : next)}
          />
          <FilteredProgress banks={banks} file={progress} filter={filter} now={clock} />
        </>
      )}
    </div>
  );
}

function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Demo data"
      className="ui flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-accent-600 bg-accent-100 px-4 py-3"
    >
      <p className="m-0 min-w-0 flex-1 text-sm text-ink">
        <strong>Demo data: this is a sample student.</strong> Eight weeks of made-up practice and
        tests, built in this page only. Nothing here is saved or sent anywhere.
      </p>
      {/* A full page load, so the real progress file is read afresh. */}
      <a
        href="/progress"
        className="text-sm font-semibold whitespace-nowrap text-accent-700 underline"
      >
        Exit the demo
      </a>
    </div>
  );
}

function EmptyProgress() {
  return (
    <Panel title="Nothing here yet">
      <p className="m-0 max-w-prose text-ink-2">
        Answer a few questions and this page fills in: how you are doing in each topic, which topics
        are worth more practice, and how the last few weeks have gone. Nothing is needed to start,
        not even an account.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/" variant="primary">
          Start a practice set
        </ButtonLink>
        <ButtonLink href="/problems" variant="secondary">
          Browse the question bank
        </ButtonLink>
        <ButtonLink href="/progress?demo=1" variant="secondary">
          See a demo student
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* One filter                                                                  */
/* -------------------------------------------------------------------------- */

function FilteredProgress({
  banks,
  file,
  filter,
  now,
}: {
  banks: readonly BankSpec[];
  file: ProgressFile;
  filter: Filter;
  now: Date;
}) {
  const exam = filter === 'all' ? undefined : examById(filter);
  const view = useMemo(() => {
    const answers = examAnswers(file, banks, filter);
    const sessions = examSessions(file, filter);
    const practice = practiceAnswers(answers);
    const topics = topicRows(answers, banks, filter, now);
    const tests = compareTests(sessions);
    const practiceTrend = compareRecent(practice, now);
    return {
      answers,
      sessions,
      topics,
      tests,
      practiceTrend,
      counts: answeredCounts(answers, now),
      time: timeStats(answers),
      weeks: weeklyStats(answers, now, ACCURACY_WEEKS),
      days: dailyActivity(answers, now, CALENDAR_WEEKS),
      series: scoreSeries(sessions),
      sentence: progressSentence({
        answers: answers.length,
        tests,
        practice: practiceTrend,
        topics,
        qualify: filter === 'all',
      }),
    };
  }, [file, banks, filter, now]);

  const spec = filter === 'all' ? undefined : banks.find((b) => b.bank === EXAM_BANK[filter]);
  const sectionNames = useMemo(() => {
    const out = new Map<string, string>();
    for (const b of banks) for (const s of b.sections) out.set(`${b.bank}|${s.id}`, s.name);
    return out;
  }, [banks]);
  const sectionName = (session: SessionRecord) =>
    session.section
      ? (sectionNames.get(`${SESSION_BANK[session.exam]}|${session.section}`) ?? session.section)
      : null;

  const { tests, practiceTrend, time } = view;
  const scope = exam ? exam.shortName : 'all exams';

  return (
    <div className="grid gap-6">
      <div className="ui rounded-card border border-rule bg-surface p-4 shadow-xs">
        <h2 className="m-0 text-2xs font-semibold tracking-wide text-ink-2 uppercase">
          In short, {scope}
        </h2>
        <p className="m-0 mt-1 text-lg leading-snug text-ink" aria-live="polite">
          {view.sentence}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile value={tests.taken} label="Tests taken" detail="mocks and section tests" />
        <StatTile
          value={percentLabel(tests.last)}
          label={`Last ${TEST_COMPARE_COUNT} tests`}
          detail={
            tests.first === null
              ? `average, after ${TEST_COMPARE_MIN} tests`
              : `average; first ${TEST_COMPARE_COUNT}: ${percentLabel(tests.first)}`
          }
        />
        <StatTile
          value={percentLabel(practiceTrend.recent.accuracy)}
          label={`Practice, ${RECENT_DAYS} days`}
          detail={
            practiceTrend.change !== null
              ? `${percentLabel(practiceTrend.earlier.accuracy)} the ${RECENT_DAYS} days before`
              : practiceTrend.recent.attempts === 0
                ? `no practice in ${RECENT_DAYS} days`
                : 'too few answers before to compare'
          }
        />
        <StatTile
          value={view.counts.total}
          label="Answered"
          detail={`${view.counts.thisWeek} this week`}
        />
        <StatTile
          value={time.timed === 0 ? '-' : timeLabel(time.totalMs)}
          label="Time on questions"
          detail={
            time.timed === 0
              ? 'not tracked yet'
              : `${secondsLabel(time.averageMs)} per question, ${plural(time.timed, 'timed answer')}`
          }
        />
      </div>

      <Panel
        title="Test scores"
        description="Each finished test as a share of its top score, one line per exam."
      >
        <ScoreChart series={view.series} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Practice by week"
          description={`Accuracy and questions answered, the last ${ACCURACY_WEEKS} weeks, Monday to Sunday.`}
        >
          <WeeklyChart weeks={view.weeks} />
        </Panel>
        <Panel title="Activity" description={`The last ${CALENDAR_WEEKS} weeks, day by day.`}>
          <ActivityCalendar days={view.days} />
        </Panel>
      </div>

      <Panel
        title="Strengths and weak spots"
        description="Every topic you have answered in, weakest first, with a short test to practise it."
      >
        <TopicTable rows={view.topics} qualify={filter === 'all'} />
      </Panel>

      {spec ? (
        <Panel
          title={`By ${PROGRESS_SECTION_NOUN[spec.bank].section}`}
          description={`Open a ${PROGRESS_SECTION_NOUN[spec.bank].section} to see each ${PROGRESS_SECTION_NOUN[spec.bank].sub}.`}
        >
          <BySection
            sections={sectionStats(view.answers, spec).map((s) => ({
              ...s,
              name: exam ? topicName(exam, s.id, s.name) : s.name,
            }))}
            subNoun={PROGRESS_SECTION_NOUN[spec.bank].sub}
          />
        </Panel>
      ) : null}

      <Panel
        title="Test history"
        description="Mocks and section tests you finished, newest first."
        actions={
          exam?.routes.mock ? (
            <ButtonLink href={exam.routes.mock} variant="secondary" size="sm">
              Take a {exam.shortName} mock
            </ButtonLink>
          ) : null
        }
      >
        <TestHistory sessions={view.sessions} file={file} sectionName={sectionName} />
      </Panel>
    </div>
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
