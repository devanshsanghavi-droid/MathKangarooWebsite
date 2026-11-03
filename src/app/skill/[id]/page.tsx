import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllSkills,
  getPapersForSkill,
  getProblemsForSkill,
  getSkill,
  paperKey,
  STRAND_META,
} from '@/lib/content';
import { POINT_VALUES, type Points, type Skill } from '@/lib/schemas';
import { SkillChip } from '@/components/SkillChip';
import { DifficultyPill } from '@/components/DifficultyPill';
import { BandPill, bandLabel } from '@/components/BandPill';
import { EmptyState } from '@/components/EmptyState';
import { SkillUnit } from '@/components/skill/SkillUnit';
import { typicalDifficulty } from '@/lib/skill-unit';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * The unit page - docs/05-DESIGN-DIRECTION.md §7.2.
 *
 * v1 was nine stacked sections: a document you read top to bottom and then closed. v2 is a
 * unit you work through - breadcrumb, title, mastery bar, then a lesson list of Learn, three
 * practice ladders and a skill quiz. Nothing was deleted; the nine sections' content moved
 * into /skill/[id]/learn and the ladders.
 *
 * The complete set of valid ids is known at build time - content lives in git and nothing is
 * created at runtime - so anything outside that set is a 404, not a page to try rendering.
 * With the default `dynamicParams: true`, Next rendered the page for an unknown id, hit
 * `notFound()`, and then cached and served that not-found body with an HTTP **200**.
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
    title: `${skill.name} (${skill.id})`,
    description: skill.definition,
    alternates: { canonical: `/skill/${skill.id}` },
    openGraph: {
      title: `${skill.name} - ${STRAND_META[skill.strand].name}`,
      description: skill.definition,
      type: 'article',
      url: `/skill/${skill.id}`,
    },
  };
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
  const prerequisites = relatedChips(skill.prerequisites);
  const unlocks = relatedChips(skill.unlocks);
  const papers = getPapersForSkill(skill.id);

  const problemIdsByTier = Object.fromEntries(
    POINT_VALUES.map((points) => [
      points,
      problems.filter((problem) => problem.points === points).map((problem) => problem.id),
    ]),
  ) as Record<Points, string[]>;

  const counts = Object.fromEntries(
    POINT_VALUES.map((points) => [points, problemIdsByTier[points]?.length ?? 0]),
  ) as Record<Points, number>;

  return (
    <div className="content-column px-4 py-8">
      {/* 1 - breadcrumb: strand › band › skill */}
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
            {skill.bands.map((band) => bandLabel(band).replace('Level ', '')).join(' · ')}
            <span className="visually-hidden"> levels</span>
          </li>
          <li aria-hidden="true">/</li>
          <li className="mono text-ink-2">{skill.id}</li>
        </ol>
      </nav>

      {/* 2 - title, one-line definition, difficulty */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-2xl">{skill.name}</h1>
          <DifficultyPill points={typicalDifficulty(counts, skill.tier)} showMeaning />
        </div>
        <p className="reading prose-measure mt-3 mb-0 text-ink-2">{skill.definition}</p>
      </header>

      {/* 3 and 4 - mastery bar and the lesson list */}
      <SkillUnit
        skillId={skill.id}
        problemIdsByTier={problemIdsByTier}
        allProblemIds={problems.map((problem) => problem.id)}
        hasWorkedExample={skill.canonicalProblem !== null}
      />

      {/* 5 - prerequisites and unlocks */}
      <section id="unit-graph" aria-labelledby="unit-graph-heading" className="mt-8">
        <h2 id="unit-graph-heading" className="m-0 text-lg">
          Before and after
        </h2>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="m-0 text-sm font-semibold text-ink">Needs first</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {prerequisites.length > 0 ? (
                prerequisites.map((prerequisite) => (
                  <SkillChip key={prerequisite.id} skill={prerequisite} />
                ))
              ) : (
                <EmptyState>Nothing. This is one of the skills the Atlas starts from.</EmptyState>
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
      </section>

      {/* 6 - in official papers, unchanged */}
      <section id="unit-papers" aria-labelledby="unit-papers-heading" className="mt-8">
        <h2 id="unit-papers-heading" className="m-0 text-lg">
          In official papers
        </h2>
        <div className="mt-3">
          {papers.length === 0 ? (
            <EmptyState action={<Link href="/papers">See the papers indexed so far</Link>}>
              No indexed official paper question has been tagged with {skill.id} yet. The index
              grows one paper at a time, and it records only question numbers, point values and our
              own skill tags - never the problems themselves.
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
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-strong"
                    >
                      <span className="mono text-xs text-ink-2">{reference.year}</span>
                      <BandPill band={reference.band} />
                      <span className="text-sm text-ink">Question {reference.questionNumber}</span>
                      <DifficultyPill points={reference.points} />
                      {reference.note ? (
                        <span className="flex-1 text-xs text-ink-3">{reference.note}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
