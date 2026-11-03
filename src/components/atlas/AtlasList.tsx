import Link from 'next/link';
import type { Skill } from '@/lib/schemas';
import { STRAND_META, TIER_META, TIER_ORDER } from '@/lib/content';
import { STRANDS } from '@/lib/schemas';
import { atlasHref, type AtlasQuery } from '@/lib/atlas-params';
import { EmptyState } from '@/components/EmptyState';
import { SkillMasteryDot } from '@/components/mastery/SkillMasteryDot';

/**
 * The nested-list view of the Atlas.
 *
 * Strand → tier → skill, as real nested lists, so a screen reader announces the depth and the
 * item counts, and so every skill is one Tab away with no pointer at all. It shows exactly the
 * same set as the graph - a test asserts that, because a fallback that quietly holds fewer
 * skills is worse than no fallback.
 *
 * Headings run h2 (strand) then h3 (tier), continuing from the page's single h1. Starting at
 * h3 skipped a level, which axe flags and which makes a screen reader's heading list lie about
 * the structure.
 */
export function AtlasList({
  skills,
  problemCounts,
  query,
}: {
  skills: readonly Skill[];
  problemCounts: ReadonlyMap<string, number>;
  query: AtlasQuery;
}) {
  const present = STRANDS.map((strand) => ({
    strand,
    skills: skills.filter((skill) => skill.strand === strand),
  })).filter((group) => group.skills.length > 0);

  if (present.length === 0) {
    return (
      <EmptyState action={<Link href={atlasHref({ view: 'list' })}>Clear the filters</Link>}>
        No skill matches these filters.
      </EmptyState>
    );
  }

  return (
    <ul className="m-0 grid list-none gap-6 p-0">
      {present.map(({ strand, skills: strandSkills }) => (
        <li key={strand}>
          <h2 className="m-0 flex flex-wrap items-baseline gap-2 text-base">
            <Link href={`/atlas/${strand}`} className="no-underline hover:underline">
              {STRAND_META[strand].name}
            </Link>
            <span className="mono text-2xs text-ink-3">{strand}</span>
            <span className="text-xs font-normal text-ink-3">
              {strandSkills.length} {strandSkills.length === 1 ? 'skill' : 'skills'}
            </span>
          </h2>
          <p className="mt-1 mb-2 text-sm text-ink-3">{STRAND_META[strand].blurb}</p>

          <ul className="m-0 grid list-none gap-3 border-l border-rule pl-4 p-0">
            {TIER_ORDER.map((tier) => {
              const tierSkills = strandSkills.filter((skill) => skill.tier === tier);
              if (tierSkills.length === 0) return null;
              return (
                <li key={tier}>
                  <h3 className="m-0 text-xs font-semibold text-ink-2">
                    {TIER_META[tier].label}
                    <span className="ml-2 font-normal text-ink-3">{TIER_META[tier].blurb}</span>
                  </h3>
                  <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
                    {tierSkills.map((skill) => {
                      const count = problemCounts.get(skill.id) ?? 0;
                      const focused = query.focus === skill.id;
                      return (
                        <li key={skill.id}>
                          <Link
                            href={`/skill/${skill.id}`}
                            aria-current={focused ? 'true' : undefined}
                            className={[
                              'flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-sm px-2 py-1.5 no-underline transition-colors',
                              focused ? 'bg-accent-100' : 'hover:bg-surface-2',
                            ].join(' ')}
                          >
                            <SkillMasteryDot skillId={skill.id} />
                            <span className="mono text-2xs text-ink-3">{skill.id}</span>
                            <span className="text-sm text-ink">{skill.name}</span>
                            <span className="mono ml-auto text-2xs text-ink-3">
                              {count === 0 ? 'no problems yet' : `${count}`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
