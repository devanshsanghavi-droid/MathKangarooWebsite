import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getProblemsForSkill,
  getSkillsByStrand,
  STRAND_META,
  TIER_META,
  TIER_ORDER,
} from '@/lib/content';
import { STRANDS, type Strand } from '@/lib/schemas';
import { atlasHref } from '@/lib/atlas-params';
import { EmptyState } from '@/components/EmptyState';

interface Params {
  params: Promise<{ strand: string }>;
}

export function generateStaticParams(): Array<{ strand: string }> {
  return STRANDS.map((strand) => ({ strand }));
}

function asStrand(value: string): Strand | null {
  return (STRANDS as readonly string[]).includes(value) ? (value as Strand) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const strand = asStrand((await params).strand);
  if (!strand) return { title: 'Strand not found', robots: { index: false } };
  const meta = STRAND_META[strand];
  return {
    title: meta.name,
    description: `${meta.blurb} The ${getSkillsByStrand(strand).length} skills in the ${meta.name} strand, in the order they are best learned.`,
    alternates: { canonical: `/atlas/${strand}` },
  };
}

/**
 * A strand, walked in order: foundation, then core, then gateway.
 *
 * The graph shows how the strand connects; this page is what you read if you want to teach it,
 * or work through it. Each skill gets its one-line trigger and its problem count, so a tutor
 * can plan a session from this page alone.
 */
export default async function StrandPage({ params }: Params) {
  const strand = asStrand((await params).strand);
  if (!strand) notFound();

  const meta = STRAND_META[strand];
  const skills = getSkillsByStrand(strand);
  const totalProblems = skills.reduce((n, skill) => n + getProblemsForSkill(skill.id).length, 0);

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
          <li className="mono text-ink-2">{strand}</li>
        </ol>
      </nav>

      <header>
        <p className="mono m-0 text-xs text-ink-3">{strand}</p>
        <h1 className="mt-1 text-2xl">{meta.name}</h1>
        <p className="prose-measure mt-3 mb-0 text-ink-2">{meta.blurb}</p>
        <p className="mt-3 mb-0 text-sm text-ink-3">
          {skills.length} skills · {totalProblems} problems ·{' '}
          <Link href={atlasHref({ strands: [strand] })} className="no-underline hover:underline">
            see this strand in the graph
          </Link>
        </p>
      </header>

      {TIER_ORDER.map((tier) => {
        const tierSkills = skills.filter((skill) => skill.tier === tier);
        return (
          <section key={tier} aria-labelledby={`tier-${tier}`} className="mt-10">
            <h2 id={`tier-${tier}`} className="m-0 text-lg">
              {TIER_META[tier].label}
            </h2>
            <p className="mt-1 mb-3 text-sm text-ink-3">{TIER_META[tier].blurb}</p>

            {tierSkills.length === 0 ? (
              <EmptyState>
                {meta.name} has no {TIER_META[tier].label.toLowerCase()} skills. Not every strand
                spans all three tiers, and that is a fact about the strand rather than a gap.
              </EmptyState>
            ) : (
              <ol className="m-0 grid list-none gap-3 p-0">
                {tierSkills.map((skill, index) => {
                  const problems = getProblemsForSkill(skill.id);
                  return (
                    <li key={skill.id}>
                      <Link
                        href={`/skill/${skill.id}`}
                        className="block rounded-sm border border-rule bg-surface p-3 no-underline hover:border-rule-2"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="mono text-2xs text-ink-3">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="mono text-2xs text-ink-3">{skill.id}</span>
                          <span className="font-medium text-ink">{skill.name}</span>
                          <span className="mono ml-auto text-2xs text-ink-3">
                            {problems.length === 0
                              ? 'no problems yet'
                              : `${problems.length} problem${problems.length === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <p className="serif mt-2 mb-0 text-sm text-ink-2">
                          “{skill.recognizeWhen[0]}”
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}

      <nav aria-label="Other strands" className="mt-12 border-t border-rule pt-6">
        <h2 className="m-0 text-sm font-semibold text-ink">The other six strands</h2>
        <ul className="mt-3 flex flex-wrap list-none gap-2 p-0">
          {STRANDS.filter((other) => other !== strand).map((other) => (
            <li key={other}>
              <Link
                href={`/atlas/${other}`}
                className="inline-flex items-baseline gap-1.5 rounded-sm border border-rule px-2 py-1 text-xs no-underline hover:border-rule-2"
              >
                <span className="mono text-2xs text-ink-3">{other}</span>
                <span className="text-ink-2">{STRAND_META[other].name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
