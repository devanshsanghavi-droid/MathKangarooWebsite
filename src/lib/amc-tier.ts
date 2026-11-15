/**
 * AMC slot -> difficulty tier -> progress points.
 *
 * Dependency-free on purpose: the browser-side progress store (local-progress.ts) needs this
 * mapping, and pulling Zod into that bundle just to turn 17 into "Middle" would be silly. The
 * schemas in amc-schemas.ts re-export everything here.
 *
 * A slot is where a problem would sit on a real 25-question paper. The tier is derived, never
 * authored, so the two can never disagree:
 *
 *   slots  1-10  Early   -> 3 points in the progress store
 *   slots 11-20  Middle  -> 4 points
 *   slots 21-25  Late    -> 5 points
 *
 * The 3 / 4 / 5 values exist only so AMC attempts fit the same AttemptRecord shape the
 * Kangaroo store already uses. They are not AMC scoring (6 / 1.5 / 0) and are never shown to
 * a student as points.
 */

export const AMC_TIERS = ['Early', 'Middle', 'Late'] as const;
export type AmcTier = (typeof AMC_TIERS)[number];

export const AMC_SLOT_MIN = 1;
export const AMC_SLOT_MAX = 25;

/** `AM-0001` - our own AMC-style problems only. Official AMC problems are never stored. */
export const AMC_PROBLEM_ID_RE = /^AM-\d{4}$/;

export function isAmcProblemId(id: string): boolean {
  return AMC_PROBLEM_ID_RE.test(id);
}

export function isValidAmcSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= AMC_SLOT_MIN && slot <= AMC_SLOT_MAX;
}

/** Throws on a slot outside 1-25: a bad slot is a content bug, not something to paper over. */
export function amcTierOf(slot: number): AmcTier {
  if (!isValidAmcSlot(slot)) throw new RangeError(`AMC slot must be an integer 1-25, got ${slot}`);
  if (slot <= 10) return 'Early';
  if (slot <= 20) return 'Middle';
  return 'Late';
}

export const AMC_TIER_POINTS: Readonly<Record<AmcTier, 3 | 4 | 5>> = {
  Early: 3,
  Middle: 4,
  Late: 5,
};

/** Points recorded in the progress store for an attempt at a problem in this slot. */
export function amcPointsOf(slot: number): 3 | 4 | 5 {
  return AMC_TIER_POINTS[amcTierOf(slot)];
}

/** The slot range a tier covers, inclusive. Handy for filter labels ("Slots 11-20"). */
export const AMC_TIER_SLOTS: Readonly<Record<AmcTier, readonly [number, number]>> = {
  Early: [1, 10],
  Middle: [11, 20],
  Late: [21, 25],
};
