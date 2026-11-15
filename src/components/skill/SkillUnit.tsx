'use client';

import Link from '@/components/AppLink';
import type { Points } from '@/lib/schemas';
import { POINT_VALUES } from '@/lib/schemas';
import { MasteryBar } from '@/components/mastery/MasteryBar';
import { MasteryDot } from '@/components/mastery/MasteryDot';
import { useProgress } from '@/components/mastery/useProgress';
import { ladderAttempts, masteryStateFor, skillProblemProgress } from '@/lib/local-progress';
import { buildLessonRows, type LessonRow } from '@/lib/skill-unit';
import { LADDER_TARGET } from '@/lib/ladder';
import { Card, CardHeader } from '@/components/ui';

/**
 * The interactive half of the unit page - docs/05-DESIGN-DIRECTION.md §7.2, items 3 and 4.
 *
 * The mastery bar and the lesson list both depend on what this browser has stored, so they are
 * client-side; the breadcrumb, title, prerequisites and paper index stay on the server. §9
 * requires the bar to work for a signed-out visitor, and it does: localStorage, the same
 * mastery state machine the server will use, and nothing sent anywhere.
 *
 * On the server pass this renders as "not started" throughout, which is the honest first-paint
 * state for a visitor with no history and avoids a hydration mismatch.
 */
export function SkillUnit({
  skillId,
  problemIdsByTier,
  allProblemIds,
  hasWorkedExample,
}: {
  skillId: string;
  problemIdsByTier: Record<Points, string[]>;
  allProblemIds: string[];
  hasWorkedExample: boolean;
}) {
  const progress = useProgress();
  const now = new Date();

  const segments = skillProblemProgress(progress, skillId, allProblemIds);
  const state = masteryStateFor(progress, skillId, now);

  const attemptsByTier = Object.fromEntries(
    POINT_VALUES.map((points) => [points, ladderAttempts(progress, skillId, points)]),
  ) as Record<Points, ReturnType<typeof ladderAttempts>>;

  const rows = buildLessonRows({
    skillId,
    problemIdsByTier,
    attemptsByTier,
    hasWorkedExample,
  });

  return (
    <>
      <Card as="section" id="unit-progress" aria-labelledby="unit-progress-heading" padding="lg">
        <CardHeader
          titleId="unit-progress-heading"
          title="Your progress"
          actions={<MasteryDot state={state} showLabel />}
        />
        <div className="mt-4">
          <MasteryBar segments={segments} />
        </div>
        <p className="ui mt-3 mb-0 text-2xs text-ink-2">
          Saved in this browser only. No account, nothing sent anywhere.
        </p>
      </Card>

      <Card
        as="section"
        id="unit-lessons"
        aria-labelledby="unit-lessons-heading"
        padding="lg"
        className="mt-6"
      >
        <CardHeader titleId="unit-lessons-heading" title="Work through it" />
        <ol className="mt-4 mb-0 grid list-none gap-2 p-0">
          {rows.map((row) => (
            <li key={row.key}>
              <LessonRowView row={row} />
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function LessonRowView({ row }: { row: LessonRow }) {
  const progressText =
    row.ladder && row.ladder.total > 0
      ? `${Math.min(row.ladder.streak, LADDER_TARGET)}/${LADDER_TARGET} in a row, ${row.ladder.solved}/${row.ladder.total} solved`
      : null;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="mono flex w-12 shrink-0 justify-center text-2xs text-ink-2"
      >
        {row.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="ui block text-sm font-medium text-ink">{row.title}</span>
        <span className="block text-xs text-ink-3">{row.blurb}</span>
      </span>
      {progressText ? (
        <span className="mono shrink-0 text-2xs text-ink-2 tabular-nums">{progressText}</span>
      ) : null}
      {row.ladder?.complete ? (
        <span className="mono shrink-0 text-2xs font-medium text-accent-700">done</span>
      ) : null}
    </>
  );

  if (row.locked) {
    return (
      <div
        aria-disabled="true"
        className="tap-target flex items-center gap-3 rounded-control border border-dashed border-rule-strong bg-surface-2 p-3"
      >
        {inner}
        <span className="shrink-0 text-2xs text-ink-3">{row.lockReason}</span>
      </div>
    );
  }

  return (
    <Link
      href={row.href}
      className="tap-target flex items-center gap-3 rounded-control border border-rule-strong bg-surface p-3 no-underline transition-colors hover:border-accent-600 hover:bg-surface-2 motion-reduce:transition-none"
    >
      {inner}
    </Link>
  );
}
