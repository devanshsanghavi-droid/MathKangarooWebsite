import type { Skill } from '@/lib/schemas';
import { STRAND_META, TIER_META } from '@/lib/taxonomy-meta';
import { SkillChip } from '@/components/SkillChip';
import { Button, ButtonLink } from '@/components/ui';
import type { AtlasSkill } from '@/lib/atlas-data';

/**
 * The side panel for the focused skill.
 *
 * A summary, not a second skill page: enough to decide whether to open the skill, and a button
 * that goes there. The focus is mirrored into the address bar with the filters, so the panel
 * is still part of a shareable view.
 */
export function SkillPanel({
  skill,
  prerequisites,
  unlocks,
  onClose,
}: {
  skill: AtlasSkill;
  prerequisites: ReadonlyArray<Pick<Skill, 'id' | 'name'>>;
  unlocks: ReadonlyArray<Pick<Skill, 'id' | 'name'>>;
  onClose: () => void;
}) {
  const problemCount = skill.problemCount;
  return (
    <aside
      aria-labelledby="focused-skill"
      className="rounded-card border border-rule bg-surface p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono m-0 text-2xs text-ink-3">{skill.id}</p>
          <h2 id="focused-skill" className="ui mt-0.5 mb-0 text-base font-semibold">
            {skill.name}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          Close
        </Button>
      </div>

      <p className="ui mt-2 mb-0 text-2xs text-ink-2">
        {STRAND_META[skill.strand].name}, {TIER_META[skill.tier].label}, levels{' '}
        {skill.bands.join(', ')}
      </p>

      <p className="reading mt-3 mb-0 text-sm text-ink-2">{skill.definition}</p>

      {prerequisites.length > 0 ? (
        <div className="mt-4">
          <h3 className="ui m-0 text-2xs font-semibold text-ink-2">Needs first</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {prerequisites.map((prerequisite) => (
              <SkillChip key={prerequisite.id} skill={prerequisite} />
            ))}
          </div>
        </div>
      ) : null}

      {unlocks.length > 0 ? (
        <div className="mt-3">
          <h3 className="ui m-0 text-2xs font-semibold text-ink-2">Opens up</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unlocks.map((unlocked) => (
              <SkillChip key={unlocked.id} skill={unlocked} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <ButtonLink href={`/skill/${skill.id}`} variant="primary" size="md">
          Open the skill page
        </ButtonLink>
        <span className="ui text-xs text-ink-2">
          {problemCount === 0
            ? 'no problems written yet'
            : `${problemCount} problem${problemCount === 1 ? '' : 's'}`}
        </span>
      </div>
    </aside>
  );
}
