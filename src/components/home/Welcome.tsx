'use client';

import { useState, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { BANDS, type Band } from '@/lib/schemas';
import { writeLevel } from '@/lib/level-pref';
import { examById, liveExams, soonExams, type Exam } from '@/lib/exams';
import {
  pickUnsolved,
  practiceSetHref,
  type HomeProblem,
  type HomeSummary,
} from '@/lib/practice-home';
import { Badge, Button, ButtonLink, cx } from '@/components/ui';
import { ExamChips } from './ExamChips';

/**
 * The first-visit home (docs/08 item 5, building on docs/06 §4). The owner rejected a cluttered
 * home before, so each section carries one idea and only the hero raises its voice:
 *
 *   hero (headline, two buttons, exam chips, puzzle of the day) - grade map - start practicing
 *   (exam cards, then the Kangaroo level step) - how it works - progress preview - more
 *   subjects coming.
 *
 * The student-progress panels only appear once there is progress to show (see PracticeHome).
 */

export interface SiteStats {
  problems: number;
  skills: number;
  misconceptions: number;
}

/** The decorative tints, in the order the level tiles cycle through them. */
type Tint = 'sky' | 'violet' | 'rose' | 'mint' | 'amber';

const TINT: Record<Tint, { bg: string; fg: string; ring: string }> = {
  sky: { bg: 'bg-sky-100', fg: 'text-sky-700', ring: 'border-sky-500' },
  violet: { bg: 'bg-violet-100', fg: 'text-violet-700', ring: 'border-violet-500' },
  rose: { bg: 'bg-rose-100', fg: 'text-rose-700', ring: 'border-rose-500' },
  mint: { bg: 'bg-mint-100', fg: 'text-mint-700', ring: 'border-mint-500' },
  amber: { bg: 'bg-amber-100', fg: 'text-amber-700', ring: 'border-amber-500' },
};

const LEVEL_TINTS: readonly Tint[] = ['sky', 'mint', 'amber', 'rose', 'violet', 'sky'];

/** Where "Explore a demo student" goes: /progress renders sample data, never stored (docs/08 item 7). */
export const DEMO_HREF = '/progress?demo=1';

/** Section headings share one size and spacing so no section shouts louder than another. */
function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="text-center">
      {eyebrow ? (
        <p className="ui m-0 text-xs font-semibold tracking-wide text-accent-700 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className={cx('mb-0 text-2xl sm:text-3xl', eyebrow ? 'mt-2' : 'mt-0')}>
        {title}
      </h2>
      {lede ? <p className="mx-auto mt-2 mb-0 max-w-lg text-base text-ink-2">{lede}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

export function WelcomeHero({ stats, potd }: { stats: SiteStats; potd: ReactNode }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="hero-glow overflow-hidden rounded-[24px] border border-rule px-4 py-10 sm:px-10 sm:py-14"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="lg:pt-4">
          <p className="ui m-0 inline-flex items-center gap-2 rounded-pill border border-rule bg-surface px-3 py-1 text-xs font-semibold text-accent-700">
            <span aria-hidden="true">✦</span> Free forever. No account needed.
          </p>
          <h1
            id="hero-heading"
            className="mt-5 mb-0 max-w-xl text-3xl leading-tight sm:text-4xl sm:leading-[1.1]"
          >
            Practice for every math exam in one place.
          </h1>
          <p className="mt-5 mb-0 max-w-lg text-lg text-ink-2">
            Original questions that explain every mistake, timed mock tests in the real format, and
            progress you can see.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#start" variant="primary" size="lg">
              Start practicing
            </ButtonLink>
            <ButtonLink href={DEMO_HREF} variant="secondary" size="lg">
              Explore a demo student
            </ButtonLink>
          </div>
          <ExamChips className="mt-8" label="Exam shortcuts" />
          <dl className="ui m-0 mt-8 flex flex-wrap gap-x-8 gap-y-4">
            <HeroStat value={stats.problems} label="original problems" />
            <HeroStat value={stats.skills} label="skills" />
            <HeroStat value={stats.misconceptions} label="mistakes explained" />
          </dl>
        </div>
        <div className="grid">{potd}</div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-xs text-ink-2">{label}</dt>
      <dd className="order-1 m-0 text-2xl font-semibold text-ink tabular-nums">
        {value.toLocaleString('en-US')}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Start practicing: exam catalog cards                                        */
/* -------------------------------------------------------------------------- */

function formatLine(exam: Exam): string {
  if (exam.tracks.length > 0) {
    return `${exam.tracks.length} levels, ${exam.format.minutes} minutes each`;
  }
  return exam.format.summary;
}

export function ExamCatalog() {
  const soon = soonExams();
  return (
    <section aria-labelledby="start-heading" id="start" className="scroll-mt-24">
      <SectionHeading
        id="start-heading"
        eyebrow="Start practicing"
        title="Choose your exam"
        lede="Each exam has its own practice, timed mock tests and question bank."
      />
      <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {liveExams().map((exam) => (
          <li key={exam.id}>
            <Link
              href={exam.routes.page}
              className={cx(
                'group flex h-full flex-col gap-1 rounded-card border border-rule border-l-4 bg-surface p-4 no-underline shadow-xs transition-shadow hover:shadow-lg motion-reduce:transition-none',
                exam.classes.border,
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={cx('ui text-base font-semibold', exam.classes.text)}>
                  {exam.name}
                </span>
                <span className="ui text-2xs text-ink-3 tabular-nums">
                  Grades {exam.grades.min}-{exam.grades.max}
                </span>
              </span>
              <span className="text-sm text-ink-2">{exam.blurb}</span>
              <span className="ui mt-auto pt-2 text-2xs text-ink-3">{formatLine(exam)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {soon.length > 0 ? (
        <p className="ui mx-auto mt-5 mb-0 max-w-2xl text-center text-xs text-ink-3">
          Coming soon:{' '}
          {soon.map((exam, i) => {
            const related = exam.related ? examById(exam.related) : undefined;
            return (
              <span key={exam.id}>
                {i > 0 ? '; ' : ''}
                <Link href={exam.routes.page} className="text-ink-2">
                  {exam.shortName}
                </Link>
                {related ? ` (try ${related.shortName} meanwhile)` : ''}
              </span>
            );
          })}
          .
        </p>
      ) : null}
      <p className="ui mt-3 mb-0 text-center text-sm">
        <Link href="/exams">All exams side by side</Link>
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Math Kangaroo level step                                                    */
/* -------------------------------------------------------------------------- */

/** How many problems the "Start" button on the level chooser puts in a set. */
const FIRST_SET_SIZE = 10;

export function LevelChooser({
  problems,
  summary,
  chosen,
}: {
  problems: readonly HomeProblem[];
  summary: HomeSummary;
  chosen: Band | null;
}) {
  const [message, setMessage] = useState('');

  const start = (band: Band): void => {
    const pool = problems.filter((problem) => problem.band === band);
    const ids = pickUnsolved(pool, summary.buckets, FIRST_SET_SIZE);
    if (ids.length === 0) {
      setMessage(`Every problem at Level ${band} is already solved. Choose another level.`);
      return;
    }
    window.location.assign(practiceSetHref(ids));
  };

  return (
    <section
      aria-labelledby="pick-level-heading"
      id="pick-level"
      className="scroll-mt-24 rounded-[24px] border border-rule bg-surface px-4 py-10 shadow-xs sm:px-10"
    >
      <div className="text-center">
        <h2 id="pick-level-heading" className="m-0 text-xl sm:text-2xl">
          Math Kangaroo: which level are you?
        </h2>
        <p className="mx-auto mt-2 mb-0 max-w-md text-base text-ink-2">
          Kangaroo levels match school grades. We will remember your choice on this device.
        </p>
      </div>

      <ul className="m-0 mx-auto mt-8 grid max-w-3xl list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
        {BANDS.map((band, i) => {
          const tint = TINT[LEVEL_TINTS[i] ?? 'sky'];
          const selected = chosen === band;
          return (
            <li key={band}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setMessage('');
                  writeLevel(band);
                }}
                className={cx(
                  'ui flex w-full cursor-pointer flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-[transform,border-color] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none',
                  tint.bg,
                  selected ? tint.ring : 'border-transparent',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className={cx('text-xl font-semibold', tint.fg)}>
                    <span className="visually-hidden">Level </span>
                    {band}
                  </span>
                  {selected ? (
                    <span aria-hidden="true" className={cx('text-sm font-semibold', tint.fg)}>
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-ink-2">
                  Grades {band} · {summary.byBand[band].total} problems
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mx-auto mt-8 max-w-3xl text-center" aria-live="polite">
        {chosen ? (
          <div className="flex flex-col items-center gap-4">
            <p className="m-0 text-base text-ink">
              Great, <strong>Level {chosen}</strong>. Where would you like to start?
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" onClick={() => start(chosen)}>
                {FIRST_SET_SIZE} quick problems
              </Button>
              <ButtonLink href="/practice/diagnostic" variant="secondary" size="lg">
                Find my weak spots
              </ButtonLink>
              <ButtonLink href={`/problems?level=${chosen}`} variant="secondary" size="lg">
                Browse all problems
              </ButtonLink>
            </div>
            {message ? <p className="m-0 text-sm text-ink-2">{message}</p> : null}
          </div>
        ) : (
          <p className="m-0 text-sm text-ink-3">Choose a level to see where to start.</p>
        )}
        <p className="ui mt-6 mb-0 text-xs text-ink-3">
          Also for Kangaroo: <Link href="/atlas">the Skill Atlas</Link> and{' '}
          <Link href="/papers">past papers matched to skills</Link>.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

const STEPS: ReadonlyArray<{ tint: Tint; title: string; body: string; icon: ReactNode }> = [
  {
    tint: 'sky',
    title: 'Learn',
    body: 'Short lessons by skill, and formula sheets for the AMC, before you start.',
    icon: (
      <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
    ),
  },
  {
    tint: 'mint',
    title: 'Practice',
    body: 'Original questions by topic. Pick a wrong answer and see the exact slip behind it.',
    icon: (
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tint: 'violet',
    title: 'Test',
    body: 'Timed mock and section tests in the real format, with a report on every question.',
    icon: <path d="M12 8v4l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 2h6" />,
  },
  {
    tint: 'rose',
    title: 'Track',
    body: 'Scores, accuracy and weak spots over time. Kept in your browser, no account needed.',
    icon: <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-6" strokeLinejoin="round" />,
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" id="how" className="scroll-mt-24">
      <SectionHeading
        id="how-heading"
        eyebrow="How it works"
        title="Learn, practice, test, track"
      />
      <ol className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-card border border-rule bg-surface p-5 shadow-xs">
            <span
              aria-hidden="true"
              className={cx(
                'flex h-11 w-11 items-center justify-center rounded-[14px]',
                TINT[step.tint].bg,
                TINT[step.tint].fg,
              )}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                {step.icon}
              </svg>
            </span>
            <h3 className="mt-4 mb-0 text-lg">
              <span className="visually-hidden">Step {i + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 mb-0 text-sm text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress preview                                                            */
/* -------------------------------------------------------------------------- */

/** Made-up weekly mock scores for the example chart. Labelled as an example on the page. */
const EXAMPLE_SCORES = [72, 75, 74, 81, 84, 83, 90, 96] as const;
const CHART = { width: 320, height: 120, pad: 12, min: 60, max: 100 } as const;

function yFor(score: number): number {
  return (
    CHART.pad + ((CHART.max - score) / (CHART.max - CHART.min)) * (CHART.height - CHART.pad * 2)
  );
}

function xFor(index: number): number {
  return CHART.pad + index * ((CHART.width - CHART.pad * 2) / (EXAMPLE_SCORES.length - 1));
}

export function ProgressPreview() {
  const exam = examById('amc10');
  const first = EXAMPLE_SCORES[0];
  const last = EXAMPLE_SCORES[EXAMPLE_SCORES.length - 1] ?? first;
  const points = EXAMPLE_SCORES.map(
    (score, i) => `${xFor(i).toFixed(1)},${yFor(score).toFixed(1)}`,
  ).join(' ');
  const colour = exam ? `var(${exam.color})` : 'var(--accent-600)';
  return (
    <section
      aria-labelledby="preview-heading"
      className="grid items-center gap-8 rounded-[24px] border border-rule bg-surface px-4 py-8 shadow-xs sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div>
        <h2 id="preview-heading" className="m-0 text-2xl">
          See your progress at a glance
        </h2>
        <p className="mt-3 mb-0 text-base text-ink-2">
          Mock scores over time, accuracy by topic and the weak spots to work on next, all from your
          own practice in this browser.
        </p>
        <div className="mt-6">
          <ButtonLink href={DEMO_HREF} variant="secondary">
            Explore a demo student
          </ButtonLink>
        </div>
      </div>
      <figure className="m-0 rounded-card border border-rule bg-surface-2 p-4">
        <figcaption className="ui flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
          <span>{exam ? `${exam.shortName} mock scores, 8 weeks` : 'Mock scores, 8 weeks'}</span>
          <Badge tone="outline">Example data</Badge>
        </figcaption>
        <svg
          role="img"
          aria-label={`Example chart, not real data: a mock score rising from ${first} to ${last} over eight weeks.`}
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="mt-3 block h-auto w-full"
        >
          {[70, 80, 90].map((score) => {
            const y = yFor(score);
            return (
              <line
                key={score}
                x1={CHART.pad}
                x2={CHART.width - CHART.pad}
                y1={y}
                y2={y}
                stroke="var(--grid)"
                strokeWidth="1"
              />
            );
          })}
          <polyline
            points={points}
            fill="none"
            stroke={colour}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={xFor(EXAMPLE_SCORES.length - 1)} cy={yFor(last)} r="4.5" fill={colour} />
        </svg>
        <p className="ui mt-2 mb-0 text-2xs text-ink-3">
          Week 1: {first}. Week 8: {last}.
        </p>
      </figure>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* More subjects                                                               */
/* -------------------------------------------------------------------------- */

export function MoreSubjects() {
  return (
    <section
      aria-labelledby="subjects-heading"
      className="rounded-card border border-dashed border-rule-strong px-4 py-4 text-center"
    >
      <h2 id="subjects-heading" className="ui m-0 text-sm font-semibold text-ink-2">
        More subjects coming: science, reading and writing
      </h2>
      <p className="ui mt-1 mb-0 text-xs text-ink-3">Math comes first. The rest will follow.</p>
    </section>
  );
}
