import { POINT_VALUES, type Points, type Tier } from './schemas';
import { ladderState, type LadderState } from './ladder';
import type { AttemptRecord } from './mastery';

/**
 * The unit page's lesson list - docs/05-DESIGN-DIRECTION.md §7.2.
 *
 * Five rows: Learn, then a ladder per point tier, then the skill quiz. The quiz is locked
 * until every ladder that HAS problems has been finished; a tier with nothing written in it
 * cannot be a barrier, or a skill with no 5-pointers would have a quiz nobody could ever open.
 *
 * Pure so the lock can be unit tested without rendering anything, and so the same rule can be
 * reused server-side when accounts arrive.
 */

export type LessonKind = 'learn' | 'ladder' | 'quiz';

export interface LessonRow {
  kind: LessonKind;
  key: string;
  title: string;
  blurb: string;
  href: string;
  /** ●○○ style glyph for a ladder, a mark for learn, a tick for the quiz. */
  icon: string;
  points?: Points;
  /** Null for rows that are not ladders. */
  ladder: LadderState | null;
  locked: boolean;
  lockReason?: string;
}

/** A rung is satisfied if it has been finished, or if there is nothing on it to finish. */
export function rungSatisfied(state: LadderState): boolean {
  return state.total === 0 || state.complete;
}

export function quizUnlocked(ladders: readonly LadderState[]): boolean {
  // A skill with no problems at all has nothing to quiz.
  if (ladders.every((rung) => rung.total === 0)) return false;
  return ladders.every(rungSatisfied);
}

/**
 * The typical difficulty of a skill, for the pill beside its title. A skill has no point value
 * of its own, so this is the point tier most of its problems sit at - and when it has no
 * problems yet, the value its Atlas tier implies.
 */
export const TIER_IMPLIED_POINTS: Record<Tier, Points> = {
  foundation: 3,
  core: 4,
  gateway: 5,
};

export function typicalDifficulty(counts: Record<Points, number>, tier: Tier): Points {
  const ranked = POINT_VALUES.filter((points) => (counts[points] ?? 0) > 0).sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a - b,
  );
  return ranked[0] ?? TIER_IMPLIED_POINTS[tier];
}

const LADDER_ICON: Record<Points, string> = { 3: '●○○', 4: '●●○', 5: '●●●' };

export function buildLessonRows({
  skillId,
  problemIdsByTier,
  attemptsByTier,
  hasWorkedExample,
}: {
  skillId: string;
  problemIdsByTier: Record<Points, readonly string[]>;
  attemptsByTier: Record<Points, readonly AttemptRecord[]>;
  hasWorkedExample: boolean;
}): LessonRow[] {
  const ladders = POINT_VALUES.map((points) =>
    ladderState(problemIdsByTier[points] ?? [], attemptsByTier[points] ?? []),
  );

  const rows: LessonRow[] = [
    {
      kind: 'learn',
      key: 'learn',
      title: 'Learn',
      blurb: hasWorkedExample
        ? 'What it is, how to spot it, a worked example, and where it goes wrong.'
        : 'What it is, how to spot it, and where it goes wrong.',
      href: `/skill/${skillId}/learn`,
      icon: '✎',
      ladder: null,
      locked: false,
    },
  ];

  POINT_VALUES.forEach((points, position) => {
    const state = ladders[position];
    if (!state) return;
    rows.push({
      kind: 'ladder',
      key: `ladder-${points}`,
      title: `Practice - ${points}-point ladder`,
      blurb:
        state.total === 0
          ? 'No problems written at this tier yet.'
          : `${state.total} problem${state.total === 1 ? '' : 's'}. Three in a row finishes it.`,
      href: `/skill/${skillId}/practice/${points}`,
      icon: LADDER_ICON[points],
      points,
      ladder: state,
      locked: state.total === 0,
      lockReason: state.total === 0 ? 'Nothing written at this tier yet' : undefined,
    });
  });

  const unlocked = quizUnlocked(ladders);
  rows.push({
    kind: 'quiz',
    key: 'quiz',
    title: 'Skill quiz',
    blurb: unlocked
      ? 'Five problems, no feedback until the end. Prove you have it.'
      : 'Finish every ladder that has problems first.',
    href: `/skill/${skillId}/quiz`,
    icon: '✓',
    ladder: null,
    locked: !unlocked,
    lockReason: unlocked ? undefined : 'Finish the ladders above first',
  });

  return rows;
}
