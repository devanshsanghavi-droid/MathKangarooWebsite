import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllSkills,
  getPapersForSkill,
  getProblem,
  getProblemsForSkill,
  getSkill,
  getGraph,
  STRAND_META,
} from '@/lib/content';
import { POINT_VALUES, type Points, type Skill } from '@/lib/schemas';
import { ProblemCard } from '@/components/ProblemCard';
import { SkillChip } from '@/components/SkillChip';
import { SkillMeta } from '@/components/SkillMeta';
import { PointPill, TIER_MEANING } from '@/components/PointPill';
import { BandPill } from '@/components/BandPill';
import { EmptyState } from '@/components/EmptyState';
import { paperKey } from '@/lib/content';

interface Params {
  params: Promise<{ id: string }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  return getAllSkills().map((skill) => ({ id: skill.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) return { title: 'Skill not found', robots: { index: false } };

  return {
    title: `${skill.name} (${skill.id})`,
    description: skill.definition,
    alternates: { canonical: `/skill/${skill.id}` },
    openGraph: {
      title: `${skill.name} — ${STRAND_META[skill.strand].name}`,
      description: skill.definition,
      type: 'article',
      url: `/skill/${skill.id}`,
    },
  };
}

/** Every section on this page renders. One that has no content says so in a sentence. */
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
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-10">
      <h2 id={`${id}-heading`} className="m-0 text-lg">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function relatedChips(ids: readonly string[]) {
  return ids
    .map((id) => getSkill(id))
    .filter((skill): skill is Skill => skill !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default async function SkillPage({ params }: Params) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  const problems = getProblemsForSkill(skill.id);
  const canonical = skill.canonicalProblem ? getProblem(skill.canonicalProblem) : undefined;
  const prerequisites = relatedChips(skill.prerequisites);
  const unlocks = relatedChips(skill.unlocks);
  const papers = getPapersForSkill(skill.id);
  const graph = getGraph();

  const ladder: Array<[Points, typeof problems]> = POINT_VALUES.map((points) => [
    points,
    problems.filter((problem) => problem.points === points),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
          <li className="mono text-ink-2">{skill.id}</li>
        </ol>
      </nav>

      {/* 1 — name, id, strand, tier, bands */}
      <header>
        <p className="mono m-0 text-xs text-ink-3">{skill.id}</p>
        <h1 className="mt-1 text-2xl">{skill.name}</h1>
        <div className="mt-5 rounded-sm border border-rule bg-surface p-4">
          <SkillMeta skill={skill} />
        </div>
      </header>

      {/* 2 — definition */}
      <Section id="definition" title="What it is">
        <p className="serif prose-measure m-0 text-lg text-ink">{skill.definition}</p>
      </Section>

      {/* 3 — you'll recognise it when… */}
      <Section id="recognise" title="You'll recognise it when…">
        <ul className="m-0 grid list-none gap-2 p-0">
          {skill.recognizeWhen.map((trigger) => (
            <li
              key={trigger}
              className="serif rounded-sm border-l-2 border-accent bg-surface px-3 py-2 text-ink-2"
            >
              “{trigger}”
            </li>
          ))}
        </ul>
      </Section>

      {/* 4 — canonical worked example */}
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

      {/* 5 — common misconceptions */}
      <Section id="misconceptions" title="Where it goes wrong">
        <p className="mt-0 mb-3 text-sm text-ink-3">
          Each of these is written the way a student would say it to themselves.
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {skill.misconceptions.map((misconception) => (
            <li
              key={misconception}
              className="serif rounded-sm border-l-2 border-incorrect bg-surface px-3 py-2 text-ink-2"
            >
              “{misconception}”
            </li>
          ))}
        </ul>
      </Section>

      {/* 6 — prerequisites and unlocks */}
      <Section id="prerequisites" title="Before and after">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="m-0 text-sm font-semibold text-ink">Needs first</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {prerequisites.length > 0 ? (
                prerequisites.map((prerequisite) => (
                  <SkillChip key={prerequisite.id} skill={prerequisite} />
                ))
              ) : (
                <EmptyState>
                  Nothing. This is one of the {graph.roots.length} skills the Atlas starts from.
                </EmptyState>
              )}
            </div>
          </div>
          <div>
            <h3 className="m-0 text-sm font-semibold text-ink">Opens up</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {unlocks.length > 0 ? (
                unlocks.map((unlocked) => <SkillChip key={unlocked.id} skill={unlocked} />)
              ) : (
                <EmptyState>
                  Nothing yet. No other skill in the Atlas lists this one as a prerequisite.
                </EmptyState>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* 7 — practice ladder, grouped by point value */}
      <Section id="practice" title="Practice ladder">
        {problems.length === 0 ? (
          <EmptyState action={<Link href="/problems">Browse the whole problem bank</Link>}>
            No problems tagged {skill.id} have been written yet. Ten new problems are authored every
            week, so this will not stay empty.
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            {ladder.map(([points, group]) => (
              <div key={points}>
                <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
                  <PointPill points={points} />
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
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-2"
                        >
                          <span className="mono text-xs text-ink-3">{problem.id}</span>
                          <BandPill band={problem.band} />
                          <span className="serif flex-1 text-sm text-ink">
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
            {/*
              Mastery state per problem is P2: it needs an account and the attempts table.
              Saying so is better than showing an empty ring that never fills.
            */}
            <p className="m-0 text-xs text-ink-3">
              Your progress through this ladder is saved once accounts exist. Practice never
              requires one.
            </p>
          </div>
        )}
      </Section>

      {/* 8 — in official papers */}
      <Section id="papers" title="In official papers">
        {papers.length === 0 ? (
          <EmptyState action={<Link href="/papers">See the papers indexed so far</Link>}>
            No indexed official paper question has been tagged with {skill.id} yet. The index grows
            one paper at a time, and it records only question numbers, point values and our own
            skill tags — never the problems themselves.
          </EmptyState>
        ) : (
          <>
            <p className="mt-0 mb-3 text-sm text-ink-3">
              Our analysis of official past papers. We link to the official PDFs; we never host
              them, and we never reproduce a question.
            </p>
            <ul className="m-0 grid list-none gap-2 p-0">
              {papers.map((reference) => (
                <li key={`${reference.year}-${reference.band}-${reference.questionNumber}`}>
                  <Link
                    href={`/papers/${paperKey(reference.year, reference.band)}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-2"
                  >
                    <span className="mono text-xs text-ink-2">{reference.year}</span>
                    <BandPill band={reference.band} />
                    <span className="text-sm text-ink">Question {reference.questionNumber}</span>
                    <PointPill points={reference.points} />
                    {reference.note ? (
                      <span className="flex-1 text-xs text-ink-3">{reference.note}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 9 — start a drill */}
      <Section id="drill" title="Drill this skill">
        {problems.length > 0 ? (
          <div className="rounded-sm border border-rule bg-surface p-4">
            <p className="m-0 text-sm text-ink-2">
              Spaced-repetition drills arrive with accounts, in Phase 2 — they schedule the{' '}
              <em>skill</em> and serve a problem you have not seen. Until then, work the ladder
              above in order, lowest tier first.
            </p>
            <p className="mt-3 mb-0 text-sm">
              <Link href={`/problem/${problems[0]?.id ?? ''}`}>
                Start with {problems[0]?.id} ({problems[0]?.points}-point)
              </Link>
            </p>
          </div>
        ) : (
          <EmptyState
            action={
              <Link href={`/atlas/${skill.strand}`}>Walk the {skill.strand} strand instead</Link>
            }
          >
            A drill needs problems, and this skill has none yet.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
