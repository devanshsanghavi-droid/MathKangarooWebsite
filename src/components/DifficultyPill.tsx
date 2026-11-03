import type { Points } from '@/lib/schemas';

/**
 * The exam's 3/4/5-point tier, shown as difficulty.
 *
 * v1 coloured these green / amber / rose, which meant a student saw red on the hardest
 * problems before reading a word of them - and red already means *wrong* everywhere else on
 * the site. The problems we most want them to attempt were pre-labelled as failure.
 *
 * v2 (docs/05-DESIGN-DIRECTION.md §3) uses a neutral slate ramp: weight, not alarm. The tier
 * is carried three times over - by the filled dots, by the point value in text, and only then
 * by the shade - so it survives greyscale, a printed worksheet, and any form of colour
 * blindness. Green, red and amber are reserved for feedback and appear nowhere near it.
 */
const TIER: Record<Points, { className: string; dots: string; filled: number }> = {
  3: { className: 'bg-d1-bg text-d1-fg', dots: '●○○', filled: 1 },
  4: { className: 'bg-d2-bg text-d2-fg', dots: '●●○', filled: 2 },
  5: { className: 'bg-d3-bg text-d3-fg', dots: '●●●', filled: 3 },
};

export const TIER_MEANING: Record<Points, string> = {
  3: 'One step from a skill you know.',
  4: 'Two steps, or one step plus a trap.',
  5: 'Needs an idea, not just a procedure.',
};

/** "3 pt · one dot of three filled" - what a screen reader hears instead of "●○○". */
export function difficultyLabel(points: Points): string {
  return `${points} points, difficulty ${TIER[points].filled} of 3`;
}

export function DifficultyPill({
  points,
  showMeaning = false,
}: {
  points: Points;
  showMeaning?: boolean;
}) {
  const tier = TIER[points];
  return (
    <span
      className={`mono inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-2xs font-medium ${tier.className}`}
      title={showMeaning ? TIER_MEANING[points] : undefined}
    >
      {/* The dots are the greyscale carrier; the words after them are the accessible name. */}
      <span aria-hidden="true" className="tracking-[0.08em]">
        {tier.dots}
      </span>
      <span className="visually-hidden">{difficultyLabel(points)}</span>
      <span aria-hidden="true">{points} pt</span>
    </span>
  );
}
