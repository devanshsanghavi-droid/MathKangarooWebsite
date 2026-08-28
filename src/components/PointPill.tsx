import type { Points } from '@/lib/schemas';

/**
 * The exam's 3/4/5-point tier, shown as a pill.
 *
 * The colours here are the only semantic use of --p3/--p4/--p5. They are never decorative,
 * so this component is the only thing allowed to reach for them, and the tier is always
 * written out in text as well - the colour is a reinforcement, never the sole carrier.
 */
const TIER_CLASS: Record<Points, string> = {
  3: 'bg-p3-bg text-p3',
  4: 'bg-p4-bg text-p4',
  5: 'bg-p5-bg text-p5',
};

const TIER_MEANING: Record<Points, string> = {
  3: 'One step from a skill you know.',
  4: 'Two steps, or one step plus a trap.',
  5: 'Needs an idea, not just a procedure.',
};

export function PointPill({
  points,
  showMeaning = false,
}: {
  points: Points;
  showMeaning?: boolean;
}) {
  return (
    <span
      className={`mono inline-flex items-center rounded-xs px-1.5 py-0.5 text-2xs font-medium ${TIER_CLASS[points]}`}
      title={showMeaning ? TIER_MEANING[points] : undefined}
    >
      {points} pt
    </span>
  );
}

export { TIER_MEANING };
