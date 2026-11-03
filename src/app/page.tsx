import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAllProblems,
  getContentStats,
  getProblem,
  getStrandSummaries,
  getSkill,
} from '@/lib/content';
import { dayNumber } from '@/lib/potd';
import { ProblemOfTheDay } from '@/components/ProblemOfTheDay';
import { ProblemCard } from '@/components/ProblemCard';
import { StrandStrip } from '@/components/StrandStrip';
import { StatTile } from '@/components/StatTile';
import { SITE } from '@/lib/site';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = {
  title: {
    absolute: `${SITE.name} - ${SITE.tagline}`,
  },
  description: SITE.description,
  alternates: { canonical: '/' },
};

/**
 * The sample problem in the hero.
 *
 * Chosen, not random: it is short enough to read in ten seconds, it has a figure, and all four
 * of its distractors come from mistakes a student actually makes - which is the point being
 * demonstrated. If it is ever removed from the bank the page falls back to the first problem
 * rather than breaking.
 */
const HERO_PROBLEM_ID = 'KA-0001';

export default function HomePage() {
  const stats = getContentStats();
  const problems = getAllProblems();
  const hero = getProblem(HERO_PROBLEM_ID) ?? problems[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <StructuredData />
      {/* ---------------------------------------------------------------- hero */}
      <section aria-labelledby="hero-heading" className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="max-w-prose">
          {/* The top of docs/05 §5's scale - 44px - exists for exactly one thing on the site. */}
          <h1 id="hero-heading" className="m-0 text-3xl sm:text-4xl">
            Math Kangaroo preparation organised by skill, not by year.
          </h1>
          <p className="mt-5 mb-0 text-lg text-ink-2">
            Every other free resource is a pile of past papers. You score 68 out of 120 and learn
            nothing you can act on. Here, every wrong answer tells you the mistake that produces it
            - so a score becomes a list of things to work on.
          </p>
          <p className="mt-4 mb-0 text-sm text-ink-3">
            Try it on the problem beside this. Pick an answer you think is wrong on purpose.
          </p>

          <ul className="mt-7 grid list-none gap-2 p-0">
            <li>
              <Link
                href="/practice/diagnostic"
                className="flex items-baseline gap-2 rounded-sm border border-accent-600 bg-accent-100 px-4 py-3 no-underline"
              >
                <span className="font-medium text-ink">Take the diagnostic</span>
                <span className="text-sm text-ink-2"> - 15 questions, no account needed</span>
              </Link>
            </li>
            <li>
              <Link
                href="/atlas"
                className="flex items-baseline gap-2 rounded-sm border border-rule bg-surface px-4 py-3 no-underline hover:border-rule-strong"
              >
                <span className="font-medium text-ink">Browse the Atlas</span>
                <span className="text-sm text-ink-2"> - the map of all {stats.skills} skills</span>
              </Link>
            </li>
            <li>
              <Link
                href="/problems"
                className="flex items-baseline gap-2 rounded-sm border border-rule bg-surface px-4 py-3 no-underline hover:border-rule-strong"
              >
                <span className="font-medium text-ink">Practice a skill</span>
                <span className="text-sm text-ink-2"> - {stats.problems} original problems</span>
              </Link>
            </li>
            <li>
              <Link
                href="/papers"
                className="flex items-baseline gap-2 rounded-sm border border-rule bg-surface px-4 py-3 no-underline hover:border-rule-strong"
              >
                <span className="font-medium text-ink">Index an official paper</span>
                <span className="text-sm text-ink-2"> - what each question actually tests</span>
              </Link>
            </li>
          </ul>
          <p className="mt-4 mb-0 text-xs text-ink-3">
            The diagnostic runs entirely on your own device - no account, nothing sent anywhere.
            Saved progress across devices arrives with accounts in Phase 2.
          </p>
        </div>

        <div>
          {hero ? <ProblemCard problem={hero} headingLevel={2} showSkills linkToProblem /> : null}
        </div>
      </section>

      {/* --------------------------------------------------------------- strands */}
      <section aria-labelledby="strands-heading" className="mt-16">
        <h2 id="strands-heading" className="m-0 text-lg">
          Seven strands
        </h2>
        <p className="prose-measure mt-2 mb-5 text-ink-2">
          Every skill belongs to one of these. The last one is the strand nobody else teaches.
        </p>
        <StrandStrip strands={getStrandSummaries()} />
      </section>

      {/* ------------------------------------------------------ problem of the day */}
      <ProblemOfTheDay
        buildDay={dayNumber(new Date())}
        candidates={problems.map((problem) => ({
          id: problem.id,
          points: problem.points,
          band: problem.band,
          statement: problem.statement,
          skillName: getSkill(problem.skills.primary)?.name ?? null,
        }))}
      />

      {/* --------------------------------------------------------------- counters */}
      <section aria-labelledby="counters-heading" className="mt-16">
        <h2 id="counters-heading" className="m-0 text-lg">
          What is here so far
        </h2>
        <p className="prose-measure mt-2 mb-5 text-ink-2">
          Counted from the files in the repository at build time, so these numbers cannot drift from
          what the site actually holds.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            value={stats.skills}
            label="Skills mapped"
            definition="Named skills in the Atlas, each with a definition and a prerequisite list."
          />
          <StatTile
            value={stats.problems}
            label="Problems authored"
            definition="Original problems written from scratch. No official problem is reproduced here."
          />
          <StatTile
            value={stats.misconceptions}
            label="Explanations written"
            definition="One per wrong answer choice: the specific mistake that produces that answer."
          />
          <StatTile
            value={stats.figures}
            label="Figures drawn"
            definition="Hand-authored SVG figures, each with author-written alt text."
          />
        </div>
        {/*
          §1.1 also lists a "students served" counter. That number belongs to the database and
          to /impact in Phase 3, and it must never be published below n = 10. Inventing it here
          would be exactly the kind of unbacked claim /impact exists to avoid.
        */}
        <p className="mt-4 mb-0 text-xs text-ink-3">
          Students-served and pre/post figures live on <code className="mono">/impact</code> from
          Phase 3, where every number comes from the database and nothing derived from fewer than
          ten students is published at all.
        </p>
      </section>
    </div>
  );
}
