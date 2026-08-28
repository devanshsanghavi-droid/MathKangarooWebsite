import type { Skill } from '@/lib/schemas';
import { STRAND_META, TIER_META } from '@/lib/content';
import { bandLabel } from './BandPill';

/**
 * The identity row of a skill: strand, tier and the bands it appears in.
 *
 * The tier carries a one-line explanation rather than standing alone, because "gateway" means
 * nothing to a student until someone says it is what the 5-point questions ask for.
 */
export function SkillMeta({ skill }: { skill: Skill }) {
  return (
    <dl className="m-0 grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="m-0 text-2xs text-ink-3">Strand</dt>
        <dd className="m-0 mt-0.5 text-ink">
          {STRAND_META[skill.strand].name}{' '}
          <span className="mono text-2xs text-ink-3">{skill.strand}</span>
        </dd>
      </div>
      <div>
        <dt className="m-0 text-2xs text-ink-3">Tier</dt>
        <dd className="m-0 mt-0.5 text-ink">
          {TIER_META[skill.tier].label}
          <span className="block text-xs text-ink-3">{TIER_META[skill.tier].blurb}</span>
        </dd>
      </div>
      <div>
        <dt className="m-0 text-2xs text-ink-3">Appears in</dt>
        <dd className="m-0 mt-0.5 text-ink">
          {skill.bands.map((band) => bandLabel(band).replace('Level ', '')).join(' · ')}
          <span className="block text-xs text-ink-3">
            {skill.bands.length === 1 ? 'one level' : `${skill.bands.length} levels`}
          </span>
        </dd>
      </div>
    </dl>
  );
}
