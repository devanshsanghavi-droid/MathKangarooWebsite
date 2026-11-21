'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import { useProgress } from '@/components/mastery/useProgress';
import { activeDaysOf, localDay, streakFrom } from '@/lib/progress-summary';
import { BANDS, STRANDS, type Band, type Strand, type Tier } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import {
  decodeHomeProblem,
  pickUnsolved,
  practiceSetHref,
  summariseHome,
  type HomeProblem,
  type HomeSummary,
} from '@/lib/practice-home';
import { LEVEL_EVENT, LEVEL_KEY, readLevel, writeLevel } from '@/lib/level-pref';
import { Button, ButtonLink, Card, CardHeader, ProgressBar, StatTile, cx } from '@/components/ui';
import {
  ExamCatalog,
  HowItWorks,
  LevelChooser,
  MoreSubjects,
  ProgressPreview,
  WelcomeHero,
  type SiteStats,
} from './Welcome';
import { ExamChips } from './ExamChips';
import { GradeMap } from './GradeMap';
import { InlinePotd, type PotdPick } from './InlinePotd';

/** What the server hands the Practice home: counts and ids, computed at build time. */
export interface HomeSkill {
  id: string;
  name: string;
  strand: Strand;
  tier: Tier;
  bands: Band[];
}

export interface HomeStrand {
  strand: Strand;
  name: string;
  skillCount: number;
}

export interface PracticeHomeProps {
  /** Encoded rows, see `encodeHomeProblem`. */
  problems: readonly string[];
  skills: readonly HomeSkill[];
  strands: readonly HomeStrand[];
  /** Puzzle-of-the-day picks: potd[i] is the puzzle for day `potdStartDay + i`. */
  potd: readonly PotdPick[];
  /** The build day, as a UTC day number (lib/potd.ts). */
  potdStartDay: number;
  /** Counted from the content files at build time, for the first-visit hero. */
  stats: SiteStats;
}

/** How many problems "Random unsolved" puts in a set. */
export const RANDOM_SET_SIZE = 10;

const TIER_RANK: Record<Tier, number> = { foundation: 0, core: 1, gateway: 2 };

function subscribeLevel(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === LEVEL_KEY) onChange();
  };
  window.addEventListener(LEVEL_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LEVEL_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function useLevel(): Band | null {
  return useSyncExternalStore(subscribeLevel, readLevel, () => null);
}

/**
 * The Practice home (docs/06-V3-REDESIGN.md §4).
 *
 * One static page that becomes two: the server (and a first-time visitor) gets a short hero, a
 * level picker and the quick starts; a returning student, recognised only by the progress file
 * in their own browser, gets a Continue card, their own counts per level and strand, and the
 * same quick starts. Nothing here asks for an account, and every number is a count of the
 * student's own solved problems: no points, no badges, no comparison with anyone else.
 */
export function PracticeHome({
  problems: rows,
  skills,
  strands,
  potd,
  potdStartDay,
  stats,
}: PracticeHomeProps) {
  const file = useProgress();
  // Answering the puzzle of the day records an attempt, which would turn a first visit into a
  // returning one mid-answer and swap the whole page out from under the feedback. Once the
  // visitor answers here, the welcome view stays for the rest of this page view.
  const [keepWelcome, setKeepWelcome] = useState(false);
  const chosenLevel = useLevel();
  const problems = useMemo(
    () => rows.map(decodeHomeProblem).filter((p): p is HomeProblem => p !== null),
    [rows],
  );
  const summary = useMemo(() => summariseHome(file, problems, new Date()), [file, problems]);
  const streak = useMemo(() => streakFrom(activeDaysOf(file), localDay(new Date())), [file]);
  const skillById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);

  // First visit (and the server render): a calm, one-idea-per-section introduction.
  if (!summary.returning || keepWelcome) {
    return (
      <div className="grid gap-16 sm:gap-20">
        <WelcomeHero
          stats={stats}
          potd={
            <InlinePotd
              picks={potd}
              startDay={potdStartDay}
              onAttempt={() => setKeepWelcome(true)}
            />
          }
        />
        <GradeMap />
        <div className="grid gap-8">
          <ExamCatalog />
          <LevelChooser problems={problems} summary={summary} chosen={chosenLevel} />
        </div>
        <HowItWorks />
        <ProgressPreview />
        <MoreSubjects />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <ReturningTop summary={summary} problems={problems} skillById={skillById} streak={streak} />

      <ExamChips label="Your exams" showSoon={false} />

      <QuickStarts problems={problems} summary={summary} skills={skills} level={chosenLevel} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LevelPanel summary={summary} chosen={chosenLevel} returning={summary.returning} />
        <div className="grid">
          <InlinePotd picks={potd} startDay={potdStartDay} />
        </div>
      </div>

      <StrandPanel strands={strands} summary={summary} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Returning student                                                           */
/* -------------------------------------------------------------------------- */

function ReturningTop({
  summary,
  problems,
  skillById,
  streak,
}: {
  summary: HomeSummary;
  problems: readonly HomeProblem[];
  skillById: ReadonlyMap<string, HomeSkill>;
  streak: number;
}) {
  const lastProblem = summary.last
    ? problems.find((problem) => problem.id === summary.last?.problemId)
    : undefined;
  const skill = lastProblem ? skillById.get(lastProblem.skill) : undefined;
  const inSkill = skill ? problems.filter((problem) => problem.skill === skill.id) : [];
  const solvedInSkill = inSkill.filter((p) => summary.buckets.get(p.id) === 'solved').length;
  const nextInSkill =
    inSkill.find((p) => (summary.buckets.get(p.id) ?? 'todo') === 'todo') ??
    inSkill.find((p) => summary.buckets.get(p.id) === 'attempted');

  return (
    <section aria-labelledby="home-heading" className="grid gap-6">
      <div>
        <p className="ui m-0 text-xs font-semibold text-ink-2">Practice</p>
        <h1 id="home-heading" className="mt-1 mb-0 text-2xl sm:text-3xl">
          Welcome back
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card padding="lg" className="lg:row-span-2">
          <CardHeader
            title="Continue"
            description={
              skill ? 'Where you were last working.' : 'Pick up with a problem you have not tried.'
            }
          />
          {skill ? (
            <div className="mt-4">
              <p className="ui m-0 flex flex-wrap items-baseline gap-2">
                <span className="mono text-2xs text-ink-3">{skill.id}</span>
                <span className="text-lg font-semibold text-ink">{skill.name}</span>
              </p>
              <p className="ui mt-1 mb-0 text-xs text-ink-2">{STRAND_META[skill.strand].name}</p>
              <ProgressBar
                className="mt-4"
                value={solvedInSkill}
                max={inSkill.length}
                label={`${skill.name}: problems solved`}
              />
              <div className="mt-5 flex flex-wrap gap-3">
                {nextInSkill ? (
                  <ButtonLink href={`/problem/${nextInSkill.id}`} variant="primary">
                    Next problem
                    <span className="visually-hidden"> in {skill.name}</span>
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/skill/${skill.id}`} variant="secondary">
                  Open the skill
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <ButtonLink href="/problems" variant="primary">
                Open the question bank
              </ButtonLink>
            </div>
          )}
        </Card>

        <StatTile
          label="Solved"
          value={summary.all.solved}
          detail={`of ${summary.all.total} problems`}
          footer={
            <ProgressBar
              hideLabel
              value={summary.all.solved}
              max={summary.all.total}
              label="Whole bank"
            />
          }
        />
        <StatTile
          label="This week"
          value={summary.solvedThisWeek}
          detail="problems solved in the last 7 days"
        />
        <StatTile
          label="Tried, not yet solved"
          value={summary.all.attempted}
          detail="worth another look"
        />
        <StatTile
          label="Streak"
          value={streak}
          detail={streak === 1 ? 'day in a row' : 'days in a row'}
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Levels                                                                      */
/* -------------------------------------------------------------------------- */

function LevelPanel({
  summary,
  chosen,
  returning,
}: {
  summary: HomeSummary;
  chosen: Band | null;
  returning: boolean;
}) {
  return (
    <Card as="section" aria-labelledby="levels-heading" padding="lg">
      <CardHeader
        titleId="levels-heading"
        title={returning ? 'Solved by level' : 'Pick your level'}
        description={
          chosen
            ? `Quick starts draw from Level ${chosen}. Choose another level any time.`
            : 'Choose the level you sit. Quick starts will draw from it.'
        }
      />
      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
        {BANDS.map((band) => {
          const count = summary.byBand[band];
          const selected = chosen === band;
          const percent = count.total === 0 ? 0 : Math.round((count.solved / count.total) * 100);
          return (
            <li key={band}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => writeLevel(band)}
                className={cx(
                  'ui flex w-full cursor-pointer flex-col items-start gap-1 rounded-control border p-3 text-left transition-colors motion-reduce:transition-none',
                  selected
                    ? 'border-accent-600 bg-accent-100'
                    : 'border-rule bg-surface hover:border-rule-strong hover:bg-surface-2',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">Level {band}</span>
                  {selected ? (
                    <span aria-hidden="true" className="text-xs text-accent-700">
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className="mono text-2xs text-ink-2 tabular-nums">
                  {count.solved} / {count.total} solved
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 block h-1.5 w-full overflow-hidden rounded-pill bg-track"
                >
                  <span
                    className="block h-full rounded-pill bg-accent-600"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick starts                                                                */
/* -------------------------------------------------------------------------- */

function QuickStarts({
  problems,
  summary,
  skills,
  level,
}: {
  problems: readonly HomeProblem[];
  summary: HomeSummary;
  skills: readonly HomeSkill[];
  level: Band | null;
}) {
  const [message, setMessage] = useState('');
  const pool = level ? problems.filter((problem) => problem.band === level) : problems;

  // The first skill at this level (foundation first) whose problems the student has not
  // touched, so "Start a skill" always means something new.
  const touchedSkills = new Set(
    problems.filter((p) => (summary.buckets.get(p.id) ?? 'todo') !== 'todo').map((p) => p.skill),
  );
  const fresh = skills
    .filter((skill) => (level ? skill.bands.includes(level) : true))
    .filter((skill) => !touchedSkills.has(skill.id))
    .sort(
      (a, b) =>
        TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
        STRANDS.indexOf(a.strand) - STRANDS.indexOf(b.strand) ||
        a.id.localeCompare(b.id),
    )[0];

  const randomUnsolved = (): void => {
    const ids = pickUnsolved(pool, summary.buckets, RANDOM_SET_SIZE);
    if (ids.length === 0) {
      setMessage(
        level
          ? `You have solved every problem at Level ${level}. Choose another level for more.`
          : 'You have solved every problem in the bank.',
      );
      return;
    }
    // A plain navigation, so this works in any tree that renders it.
    window.location.assign(practiceSetHref(ids));
  };

  const card = 'flex h-full flex-col gap-3';

  return (
    <section aria-labelledby="quick-heading">
      <h2 id="quick-heading" className="ui m-0 text-lg font-semibold">
        Quick start
      </h2>
      <ul className="m-0 mt-3 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <Card padding="md" className={card}>
            <CardHeader
              level={3}
              title="Diagnostic"
              description="About 15 questions that follow the skill graph and end in a six-week plan."
            />
            <ButtonLink href="/practice/diagnostic" variant="secondary" className="mt-auto">
              Take the diagnostic
            </ButtonLink>
          </Card>
        </li>
        <li>
          <Card padding="md" className={card}>
            <CardHeader
              level={3}
              title="Mock test"
              description="A full timed paper in the real shape, with a report on where the points went."
            />
            <ButtonLink href="/practice/mock" variant="secondary" className="mt-auto">
              Sit a mock test
            </ButtonLink>
          </Card>
        </li>
        <li>
          <Card padding="md" className={card}>
            <CardHeader
              level={3}
              title="Random unsolved"
              description={`${RANDOM_SET_SIZE} problems you have not solved yet${
                level ? `, from Level ${level}` : ', from any level'
              }.`}
            />
            <Button variant="primary" onClick={randomUnsolved} className="mt-auto">
              Start a random set
            </Button>
            <p className="ui m-0 text-xs text-ink-2" aria-live="polite">
              {message}
            </p>
          </Card>
        </li>
        <li>
          <Card padding="md" className={card}>
            <CardHeader
              level={3}
              title="Start a skill"
              description={
                fresh
                  ? `Next new skill${level ? ` at Level ${level}` : ''}: ${fresh.name}.`
                  : 'Every skill here has been started. Browse the Atlas for the next step.'
              }
            />
            <ButtonLink
              href={fresh ? `/skill/${fresh.id}` : '/atlas'}
              variant="secondary"
              className="mt-auto"
            >
              {fresh ? 'Start this skill' : 'Open the Skill Atlas'}
            </ButtonLink>
          </Card>
        </li>
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Strands                                                                     */
/* -------------------------------------------------------------------------- */

function StrandPanel({
  strands,
  summary,
}: {
  strands: readonly HomeStrand[];
  summary: HomeSummary;
}) {
  return (
    <Card as="section" aria-labelledby="strands-heading" padding="lg">
      <CardHeader
        titleId="strands-heading"
        title="Seven strands"
        description="Every skill belongs to one of these. Solved counts are yours, from this browser."
        actions={
          <Link href="/atlas" className="ui text-sm">
            Open the Atlas
          </Link>
        }
      />
      <ul className="m-0 mt-5 grid list-none gap-x-8 gap-y-5 p-0 md:grid-cols-2">
        {strands.map((strand) => {
          const count = summary.byStrand[strand.strand];
          return (
            <li key={strand.strand}>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                <span className="mono text-2xs text-ink-3">{strand.strand}</span>
                <Link
                  href={`/atlas/${strand.strand}`}
                  className="ui text-sm font-semibold text-ink no-underline hover:underline"
                >
                  {strand.name}
                </Link>
                <span className="ui ml-auto text-2xs text-ink-3">{strand.skillCount} skills</span>
              </div>
              <ProgressBar
                hideLabel
                value={count.solved}
                max={count.total}
                label={`${strand.name}: problems solved`}
              />
              <p className="mono m-0 mt-1 text-2xs text-ink-2 tabular-nums">
                {count.solved} / {count.total} solved
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
