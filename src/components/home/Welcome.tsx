'use client';

import { useState, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { BANDS, type Band } from '@/lib/schemas';
import { writeLevel } from '@/lib/level-pref';
import {
  pickUnsolved,
  practiceSetHref,
  type HomeProblem,
  type HomeSummary,
} from '@/lib/practice-home';
import { Button, ButtonLink, cx } from '@/components/ui';

/**
 * The first-visit home (docs/06 §4, revised 2026-11-17 after owner feedback that the old home
 * was "too clustered"). One idea per section, top to bottom: what this is, how it works, pick
 * your level, then a couple of extras. The student-progress panels only appear once there is
 * progress to show (see PracticeHome).
 */

export interface SiteStats {
  problems: number;
  skills: number;
  misconceptions: number;
}

/** The four decorative tints, in the order the level tiles cycle through them. */
type Tint = 'sky' | 'violet' | 'rose' | 'mint' | 'amber';

const TINT: Record<Tint, { bg: string; fg: string; ring: string }> = {
  sky: { bg: 'bg-sky-100', fg: 'text-sky-700', ring: 'border-sky-500' },
  violet: { bg: 'bg-violet-100', fg: 'text-violet-700', ring: 'border-violet-500' },
  rose: { bg: 'bg-rose-100', fg: 'text-rose-700', ring: 'border-rose-500' },
  mint: { bg: 'bg-mint-100', fg: 'text-mint-700', ring: 'border-mint-500' },
  amber: { bg: 'bg-amber-100', fg: 'text-amber-700', ring: 'border-amber-500' },
};

const LEVEL_TINTS: readonly Tint[] = ['sky', 'mint', 'amber', 'rose', 'violet', 'sky'];

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

export function WelcomeHero({ stats }: { stats: SiteStats }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="hero-glow overflow-hidden rounded-[24px] border border-rule px-5 py-10 sm:px-10 sm:py-14"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <p className="ui m-0 inline-flex items-center gap-2 rounded-pill border border-rule bg-surface px-3 py-1 text-xs font-semibold text-accent-700">
            <span aria-hidden="true">✦</span> Free forever. No account needed.
          </p>
          <h1
            id="hero-heading"
            className="mt-5 mb-0 max-w-xl text-3xl leading-tight sm:text-4xl sm:leading-[1.1]"
          >
            Get ready for Math Kangaroo, one skill at a time.
          </h1>
          <p className="mt-5 mb-0 max-w-lg text-lg text-ink-2">
            Short practice sets that explain every mistake you make. Pick your level and start in
            seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#pick-level" variant="primary" size="lg">
              Start practicing
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
          <dl className="ui m-0 mt-10 flex flex-wrap gap-x-8 gap-y-4">
            <HeroStat value={stats.problems} label="original problems" />
            <HeroStat value={stats.skills} label="skills" />
            <HeroStat value={stats.misconceptions} label="mistakes explained" />
          </dl>
        </div>
        <SampleCard />
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

/**
 * A picture of the product, not a working problem: a small original question with the wrong
 * answer a student might pick and the explanation they would get. Decorative, so it is hidden
 * from assistive technology; the paragraph beside it already says what it shows. It uses the
 * accent and a decorative tint, never the reserved feedback colours, because nobody here has
 * actually answered anything.
 */
function SampleCard() {
  const choices = ['8', '9', '10', '12'];
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none">
      <div className="rounded-card border border-rule bg-surface p-5 shadow-lg">
        <p className="ui m-0 flex items-center gap-2 text-2xs text-ink-3">
          <span className="rounded-pill bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
            Level 3-4
          </span>
          Counting
        </p>
        <p className="mt-3 mb-0 text-base text-ink">
          A ribbon is cut into 9 equal pieces. How many cuts were made?
        </p>
        <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2 p-0">
          {choices.map((choice, i) => (
            <li
              key={choice}
              className={cx(
                'ui flex items-center gap-2 rounded-control border px-3 py-2 text-sm',
                choice === '9' ? 'border-accent-600 bg-accent-100' : 'border-rule',
              )}
            >
              <span className="mono text-2xs text-ink-3">{String.fromCharCode(65 + i)}</span>
              {choice}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative -mt-3 ml-6 rounded-card border border-rule bg-violet-100 p-4 shadow-lg sm:ml-12">
        <p className="ui m-0 text-xs font-semibold text-violet-700">Why you might pick 9</p>
        <p className="mt-1 mb-0 text-sm text-ink">
          I counted the pieces, not the cuts. The last piece needs no cut after it, so 9 pieces take
          8 cuts.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

const STEPS: ReadonlyArray<{ tint: Tint; title: string; body: string; icon: ReactNode }> = [
  {
    tint: 'sky',
    title: 'Pick your level',
    body: 'Levels follow the contest: 1-2 up to 11-12. Every problem is written for one of them.',
    icon: <path d="M4 17l8 4 8-4M4 12l8 4 8-4M12 3l8 4-8 4-8-4 8-4z" strokeLinejoin="round" />,
  },
  {
    tint: 'mint',
    title: 'Practice by skill',
    body: 'Problems are grouped into small skills, so you know exactly what you are getting better at.',
    icon: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" strokeLinejoin="round" />,
  },
  {
    tint: 'rose',
    title: 'Learn from each mistake',
    body: 'Pick a wrong answer and you see the exact slip that leads to it, plus hints and a full solution.',
    icon: (
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"
        strokeLinejoin="round"
      />
    ),
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" id="how" className="scroll-mt-24">
      <div className="text-center">
        <p className="ui m-0 text-xs font-semibold tracking-wide text-accent-700 uppercase">
          How it works
        </p>
        <h2 id="how-heading" className="mt-2 mb-0 text-2xl sm:text-3xl">
          Three steps, no sign-up
        </h2>
      </div>
      <ol className="m-0 mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-card border border-rule bg-surface p-6 shadow-xs">
            <span
              aria-hidden="true"
              className={cx(
                'flex h-12 w-12 items-center justify-center rounded-[14px]',
                TINT[step.tint].bg,
                TINT[step.tint].fg,
              )}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
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
/* Level chooser                                                               */
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
      className="scroll-mt-24 rounded-[24px] border border-rule bg-surface px-5 py-10 shadow-xs sm:px-10"
    >
      <div className="text-center">
        <h2 id="pick-level-heading" className="m-0 text-2xl sm:text-3xl">
          Which level are you?
        </h2>
        <p className="mx-auto mt-2 mb-0 max-w-md text-base text-ink-2">
          Math Kangaroo levels match school grades. We will remember your choice on this device.
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
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Extras                                                                      */
/* -------------------------------------------------------------------------- */

export function MoreToExplore({ potd }: { potd: ReactNode }) {
  return (
    <section aria-labelledby="more-heading">
      <h2 id="more-heading" className="m-0 text-center text-2xl sm:text-3xl">
        More to explore
      </h2>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="grid">{potd}</div>
        <div className="flex flex-col gap-4">
          <ExploreCard
            tint="violet"
            href="/atlas"
            title="The Skill Atlas"
            body="See every skill on one map, and which ones lead into which."
          />
          <ExploreCard
            tint="amber"
            href="/amc"
            title="AMC 10 and 12 (beta)"
            body="Problems sorted by type, plus formula flashcards for the bigger contests."
          />
          <ExploreCard
            tint="rose"
            href="/papers"
            title="Past papers"
            body="Links to the official free papers, with every question matched to its skill."
          />
        </div>
      </div>
    </section>
  );
}

function ExploreCard({
  tint,
  href,
  title,
  body,
}: {
  tint: Tint;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group flex items-center gap-4 rounded-card border border-rule p-5 no-underline transition-shadow hover:shadow-lg motion-reduce:transition-none',
        TINT[tint].bg,
      )}
    >
      <span className="flex-1">
        <span className={cx('ui block text-base font-semibold', TINT[tint].fg)}>{title}</span>
        <span className="mt-1 block text-sm text-ink-2">{body}</span>
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'text-xl transition-transform motion-safe:group-hover:translate-x-1',
          TINT[tint].fg,
        )}
      >
        →
      </span>
    </Link>
  );
}
