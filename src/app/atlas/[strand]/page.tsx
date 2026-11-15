import type { Metadata } from 'next';
import Link from '@/components/AppLink';
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
import { SkillMasteryDot } from '@/components/mastery/SkillMasteryDot';
import { ButtonLink, Card, CardHeader, PageContainer, PageHeader } from '@/components/ui';

interface Params {
  params: Promise<{ strand: string }>;
}

/**
 * The complete set of valid ids is known at build time - content lives in git and nothing is
 * created at runtime - so anything outside that set is a 404, not a page to try rendering.
 *
 * This is not a micro-optimisation. With the default `dynamicParams: true`, Next rendered the
 * page for an unknown id, hit `notFound()`, and then cached and served that not-found body with
 * an HTTP **200**. A wrong URL looked fine to a crawler and to any client that checks the
 * status rather than the words on the page.
 */
export const dynamicParams = false;

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
    <PageContainer>
      <nav aria-label="Breadcrumb" className="ui mb-4 text-xs text-ink-2">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/atlas" className="no-underline hover:underline">
              Atlas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="mono">{strand}</li>
        </ol>
      </nav>

      <PageHeader
        eyebrow={<span className="mono">{strand}</span>}
        title={meta.name}
        description={meta.blurb}
        actions={
          <ButtonLink href={atlasHref({ strands: [strand] })} rel="nofollow" variant="secondary">
            See this strand in the graph
          </ButtonLink>
        }
      />
      <p className="ui -mt-2 mb-0 text-sm text-ink-2">
        <span className="font-semibold text-ink tabular-nums">{skills.length}</span> skills,{' '}
        <span className="font-semibold text-ink tabular-nums">{totalProblems}</span> problems
      </p>

      <div className="mt-6 grid gap-6">
        {TIER_ORDER.map((tier) => {
          const tierSkills = skills.filter((skill) => skill.tier === tier);
          return (
            <Card as="section" key={tier} aria-labelledby={`tier-${tier}`} padding="lg">
              <CardHeader
                titleId={`tier-${tier}`}
                title={TIER_META[tier].label}
                description={TIER_META[tier].blurb}
              />

              {tierSkills.length === 0 ? (
                <div className="mt-4">
                  <EmptyState>
                    {meta.name} has no {TIER_META[tier].label.toLowerCase()} skills. Not every
                    strand spans all three tiers, and that is a fact about the strand rather than a
                    gap.
                  </EmptyState>
                </div>
              ) : (
                <ol className="m-0 mt-4 grid list-none gap-2 p-0 md:grid-cols-2">
                  {tierSkills.map((skill, index) => {
                    const problems = getProblemsForSkill(skill.id);
                    return (
                      <li key={skill.id}>
                        <Link
                          href={`/skill/${skill.id}`}
                          className="flex h-full flex-col rounded-control border border-rule bg-surface p-3 no-underline transition-colors hover:border-rule-strong hover:bg-surface-2 motion-reduce:transition-none"
                        >
                          <span className="ui flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <SkillMasteryDot skillId={skill.id} />
                            <span className="mono text-2xs text-ink-3">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="mono text-2xs text-ink-3">{skill.id}</span>
                            <span className="text-sm font-semibold text-ink">{skill.name}</span>
                            <span className="mono ml-auto text-2xs text-ink-2">
                              {problems.length === 0
                                ? 'no problems yet'
                                : `${problems.length} problem${problems.length === 1 ? '' : 's'}`}
                            </span>
                          </span>
                          <span className="reading mt-2 block text-sm text-ink-2">
                            &ldquo;{skill.recognizeWhen[0]}&rdquo;
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          );
        })}
      </div>

      <nav aria-label="Other strands" className="mt-10">
        <h2 className="ui m-0 text-sm font-semibold text-ink">The other six strands</h2>
        <ul className="mt-3 flex flex-wrap list-none gap-2 p-0">
          {STRANDS.filter((other) => other !== strand).map((other) => (
            <li key={other}>
              <Link
                href={`/atlas/${other}`}
                className="ui inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-rule-strong bg-surface px-3 text-xs no-underline hover:bg-surface-2"
              >
                <span className="mono text-2xs text-ink-3">{other}</span>
                <span className="text-ink">{STRAND_META[other].name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PageContainer>
  );
}
