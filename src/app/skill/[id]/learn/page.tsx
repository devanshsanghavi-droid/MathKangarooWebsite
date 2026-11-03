import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllSkills,
  getProblem,
  getProblemsForSkill,
  getSkill,
  STRAND_META,
} from '@/lib/content';
import { POINT_VALUES, type Points } from '@/lib/schemas';
import { ProblemCard } from '@/components/ProblemCard';
import { SkillMeta } from '@/components/SkillMeta';
import { DifficultyPill, TIER_MEANING } from '@/components/DifficultyPill';
import { BandPill } from '@/components/BandPill';
import { EmptyState } from '@/components/EmptyState';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * "Learn" - the first row of the unit's lesson list (docs/05 §7.2).
 *
 * This is where four of v1's nine skill-page sections moved, unchanged in substance: what the
 * skill is, how to recognise it, a fully worked example, and where it goes wrong. The unit
 * page above it is now navigation; this is the reading.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAllSkills().map((skill) => ({ id: skill.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) return { title: 'Skill not found', robots: { index: false } };
  return {
    title: `Learn ${skill.name} (${skill.id})`,
    description: skill.definition,
    alternates: { canonical: `/skill/${skill.id}/learn` },
  };
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-8">
      <h2 id={`${id}-heading`} className="m-0 text-lg">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function SkillLearnPage({ params }: Params) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  const canonical = skill.canonicalProblem ? getProblem(skill.canonicalProblem) : undefined;
  const problems = getProblemsForSkill(skill.id);
  const ladder: Array<[Points, typeof problems]> = POINT_VALUES.map((points) => [
    points,
    problems.filter((problem) => problem.points === points),
  ]);

  return (
    <div className="content-column px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/atlas" className="no-underline hover:underline">
              Atlas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/atlas/${skill.strand}`} className="no-underline hover:underline">
              {STRAND_META[skill.strand].name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/skill/${skill.id}`} className="no-underline hover:underline">
              {skill.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink-2">Learn</li>
        </ol>
      </nav>

      <header>
        <p className="mono m-0 text-xs text-ink-3">{skill.id}</p>
        <h1 className="mt-1 text-2xl">Learn: {skill.name}</h1>
        <div className="mt-5 rounded-md border border-rule bg-surface p-4">
          <SkillMeta skill={skill} />
        </div>
      </header>

      <Section id="definition" title="What it is">
        <p className="statement prose-measure m-0 text-ink">{skill.definition}</p>
      </Section>

      <Section id="recognise" title="You'll recognise it when…">
        <ul className="m-0 grid list-none gap-2 p-0">
          {skill.recognizeWhen.map((trigger) => (
            <li
              key={trigger}
              className="reading rounded-sm border-l-2 border-accent-600 bg-surface px-3 py-2 text-ink-2"
            >
              “{trigger}”
            </li>
          ))}
        </ul>
      </Section>

      <Section id="example" title="Worked example">
        {canonical ? (
          <ProblemCard problem={canonical} headingLevel={3} showSkills={false} linkToProblem />
        ) : (
          <EmptyState
            action={
              <Link href={`/problems?skill=${skill.id}`}>See every problem tagged {skill.id}</Link>
            }
          >
            No worked example has been written for this skill yet. When one is, it appears here
            fully solved, with its figure.
          </EmptyState>
        )}
      </Section>

      {/*
        The misconceptions list is a CATEGORY, not a response to anything the reader just did,
        so it does not get the reserved red it had in v1 (docs/05 §2). It is set off by a
        neutral rule and by being quoted in the student's own voice.
      */}
      <Section id="misconceptions" title="Where it goes wrong">
        <p className="mt-0 mb-3 text-sm text-ink-3">
          Each of these is written the way a student would say it to themselves.
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {skill.misconceptions.map((misconception) => (
            <li
              key={misconception}
              className="reading rounded-sm border-l-2 border-rule-strong bg-surface px-3 py-2 text-ink-2"
            >
              “{misconception}”
            </li>
          ))}
        </ul>
      </Section>

      <Section id="every-problem" title="Every problem in this skill">
        {problems.length === 0 ? (
          <EmptyState action={<Link href="/problems">Browse the whole problem bank</Link>}>
            No problems tagged {skill.id} have been written yet.
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            {ladder.map(([points, group]) => (
              <div key={points}>
                <h3 className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  <DifficultyPill points={points} />
                  <span className="font-normal text-ink-3">{TIER_MEANING[points]}</span>
                </h3>
                {group.length === 0 ? (
                  <p className="mt-2 mb-0 text-sm text-ink-3">
                    Nothing at this tier yet for {skill.id}.
                  </p>
                ) : (
                  <ul className="mt-2 grid list-none gap-2 p-0">
                    {group.map((problem) => (
                      <li key={problem.id}>
                        <Link
                          href={`/problem/${problem.id}`}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-strong"
                        >
                          <span className="mono text-xs text-ink-3">{problem.id}</span>
                          <BandPill band={problem.band} />
                          <span className="reading flex-1 text-sm text-ink">
                            {problem.statement.length > 96
                              ? `${problem.statement.slice(0, 93)}…`
                              : problem.statement}
                          </span>
                          {problem.skills.primary === skill.id ? null : (
                            <span className="mono text-2xs text-ink-3">also tests this</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <p className="mt-8 mb-0 text-sm">
        <Link href={`/skill/${skill.id}`}>Back to {skill.name}</Link>
      </p>
    </div>
  );
}
