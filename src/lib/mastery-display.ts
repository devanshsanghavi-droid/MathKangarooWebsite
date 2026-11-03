import type { MasteryState } from './mastery';

/**
 * How the four mastery states are NAMED and DRAWN. Display only.
 *
 * docs/05-DESIGN-DIRECTION.md §3 renames `shaky` to "Proficient" in the interface while
 * keeping the internal name, because `shaky` describes what the state machine measures
 * (accuracy under 70%, or a higher-tier miss after a lower-tier solve) and "Proficient"
 * describes where the student actually is: past familiar, not yet solid.
 *
 * Two orderings of the same four states coexist on purpose, and it is worth knowing which is
 * which before reading either:
 *
 *   step (here)            exposure - how far through the skill the student is
 *   MASTERY_RANK (mastery) urgency - what to put in front of them next, worst first
 *
 * They disagree about `seen` vs `shaky`, and that is not a bug: a student who has missed a
 * 5-pointer after solving a 3-pointer knows more than one with two neutral attempts, and also
 * needs help sooner.
 *
 * Every indicator carries `label` and `icon` as well as `token`. docs/05 §7.5: mastery is
 * shown as name + icon + colour, never colour alone - which is also what makes it survive a
 * greyscale print.
 */
export interface MasteryDisplay {
  /** 0-3. Also the index into the --m0..--m3 ramp. */
  step: 0 | 1 | 2 | 3;
  label: string;
  /** A distinct glyph per step, so the ramp reads with no colour at all. */
  icon: string;
  /** The CSS custom property holding this step's colour. */
  token: `--m${0 | 1 | 2 | 3}`;
  /** Tailwind background utility for the same step. */
  fill: string;
  /**
   * Tailwind text utility for the glyph drawn ON `fill`. Ink on every step but the last: in
   * the dark theme --m3 is a light teal, and ink on it measured 1.88:1, so the tick on a
   * mastered or solved item all but vanished. Ground reverses it.
   */
  glyph: string;
  blurb: string;
}

export const MASTERY_DISPLAY: Record<MasteryState, MasteryDisplay> = {
  unseen: {
    step: 0,
    label: 'Not started',
    icon: '○',
    token: '--m0',
    fill: 'bg-m0',
    glyph: 'text-ink',
    blurb: 'You have not attempted a problem in this skill.',
  },
  seen: {
    step: 1,
    label: 'Familiar',
    icon: '◔',
    token: '--m1',
    fill: 'bg-m1',
    glyph: 'text-ink',
    blurb: 'You have attempted it. Nothing conclusive yet.',
  },
  shaky: {
    step: 2,
    label: 'Proficient',
    icon: '◕',
    token: '--m2',
    fill: 'bg-m2',
    glyph: 'text-ink',
    blurb: 'You can do it, but not reliably yet - or a harder version caught you out.',
  },
  mastered: {
    step: 3,
    label: 'Mastered',
    icon: '✓',
    token: '--m3',
    fill: 'bg-m3',
    glyph: 'text-ground',
    blurb: 'Three in a row, across two days, without leaning on a hint.',
  },
};

/**
 * Resolve the state the interface should SHOW, given the state the machine computed.
 *
 * `shaky` is reached two different ways: by accuracy below 70%, and by missing a harder
 * version of something you have already solved. docs/05 §3 maps it to "Proficient", which is
 * right for the second reading and badly wrong for the first - a student who gets their very
 * first question wrong is `shaky` by accuracy, and telling them they are Proficient is a claim
 * the site has no evidence for. Seen on screen within a minute of the ramp going in.
 *
 * So `shaky` displays as Proficient only once the student has actually been right about
 * something in this skill. Otherwise it displays as Familiar: you have met this, nothing more.
 * mastery.ts is untouched, exactly as §3 asks - this is the display layer doing display.
 */
export function resolveMasteryState(state: MasteryState, everCorrect: boolean): MasteryState {
  return state === 'shaky' && !everCorrect ? 'seen' : state;
}

/** The ramp in display order, for legends. Same order as MASTERY_STATES, and a test says so. */
export const MASTERY_LEGEND: readonly MasteryState[] = ['unseen', 'seen', 'shaky', 'mastered'];

export function masteryLabel(state: MasteryState): string {
  return MASTERY_DISPLAY[state].label;
}
