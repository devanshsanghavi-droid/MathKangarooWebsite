import Link from 'next/link';
import type { Skill } from '@/lib/schemas';
import { STRAND_META, TIER_META } from '@/lib/content';
import { atlasHref, type AtlasQuery } from '@/lib/atlas-params';
import { SkillChip } from '@/components/SkillChip';

/**
 * The side panel for the focused skill.
 *
 * A summary, not a second skill page: enough to decide whether to open the skill, and a link
 * that goes there. It renders on the server from the `focus` query parameter, so the panel is
 * part of a shareable URL rather than transient client state.
 */
export function SkillPanel({
  skill,
  problemCount,
  prerequisites,
  unlocks,
  query,
}: {
  skill: Skill;
  problemCount: number;
  prerequisites: readonly Skill[];
  unlocks: readonly Skill[];
  query: AtlasQuery;
}) {
  return (
    <aside aria-labelledby="focused-skill" className="rounded-md border border-rule bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono m-0 text-2xs text-ink-3">{skill.id}</p>
          <h2 id="focused-skill" className="mt-0.5 text-base">
            {skill.name}
          </h2>
        </div>
        <Link
          href={atlasHref({ ...query, focus: null })}
          scroll={false}
          className="shrink-0 text-xs text-ink-3 no-underline hover:text-ink"
        >
          Close
        </Link>
      </div>

      <p className="mt-2 mb-0 text-2xs text-ink-3">
        {STRAND_META[skill.strand].name} · {TIER_META[skill.tier].label} · levels{' '}
        {skill.bands.map((band) => band.replace('-', '–')).join(', ')}
      </p>

      <p className="reading mt-3 mb-0 text-sm text-ink-2">{skill.definition}</p>

      {prerequisites.length > 0 ? (
        <div className="mt-4">
          <h3 className="m-0 text-2xs text-ink-3">Needs first</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {prerequisites.map((prerequisite) => (
              <SkillChip key={prerequisite.id} skill={prerequisite} />
            ))}
          </div>
        </div>
      ) : null}

      {unlocks.length > 0 ? (
        <div className="mt-3">
          <h3 className="m-0 text-2xs text-ink-3">Opens up</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unlocks.map((unlocked) => (
              <SkillChip key={unlocked.id} skill={unlocked} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 mb-0 flex flex-wrap items-baseline gap-x-3 text-sm">
        <Link href={`/skill/${skill.id}`}>Open the skill page</Link>
        <span className="text-xs text-ink-3">
          {problemCount === 0
            ? 'no problems written yet'
            : `${problemCount} problem${problemCount === 1 ? '' : 's'}`}
        </span>
      </p>
    </aside>
  );
}
