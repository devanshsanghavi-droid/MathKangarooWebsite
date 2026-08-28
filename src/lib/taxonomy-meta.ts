import type { Strand, Tier } from './schemas';

/**
 * Display names and one-line descriptions for the taxonomy's vocabularies.
 *
 * This lives apart from `content.ts` because client components need it — the Atlas graph
 * labels its columns with strand names — and `content.ts` imports `server-only` and the
 * filesystem. Splitting the prose out keeps the loader server-only without forcing the graph
 * to pass every label down as a prop.
 */

export const STRAND_META: Record<Strand, { name: string; blurb: string }> = {
  NUM: {
    name: 'Number & Arithmetic',
    blurb:
      'Digits, divisibility, remainders, fractions and the arithmetic shortcuts worth knowing.',
  },
  CNT: {
    name: 'Counting',
    blurb: 'Listing without missing anything, then the principles that replace the listing.',
  },
  GEO: {
    name: 'Geometry & Visualization',
    blurb: 'Shape, area, symmetry, and the 2D-to-3D reasoning the exam leans on heavily.',
  },
  LOG: {
    name: 'Logic & Deduction',
    blurb: 'Reading a statement exactly, and the arguments that prove something is impossible.',
  },
  PAT: {
    name: 'Patterns & Sequences',
    blurb: 'Turning a picture into numbers, then a rule, then a distant term.',
  },
  MOD: {
    name: 'Modeling & Word Problems',
    blurb: 'Getting from a sentence to a calculation, and back to an answer in the right units.',
  },
  CFT: {
    name: 'Contest Craft',
    blurb: 'How to take the exam: triage, back-solving, bounding, and never leaving a blank.',
  },
};

export const TIER_ORDER: readonly Tier[] = ['foundation', 'core', 'gateway'];

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  foundation: { label: 'Foundation', blurb: 'Assumed by everything above it.' },
  core: { label: 'Core', blurb: 'The working middle of the exam.' },
  gateway: { label: 'Gateway', blurb: 'What the 5-point questions actually ask for.' },
};
