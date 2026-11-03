'use client';

import { useProgress } from '@/components/mastery/useProgress';
import { bankProgress, localDay } from '@/lib/progress-summary';
import type { Points } from '@/lib/schemas';

/**
 * The strip above the problem bank: where you are, at a glance.
 *
 * docs/05 §8 rules out energy points and badges, and CLAUDE.md rules out leaderboards, so
 * there is no currency here and nothing to compare against another student. What it shows is
 * your own position: how much of each tier you have cleared, how many skills you have opened,
 * and whether you kept the habit going. That is the part of progress display that survives
 * the objection to extrinsic rewards, because every number is a fact about the maths you did.
 *
 * Colours come from the mastery ramp, never the reserved feedback three: a solved count is a
 * standing total, not a response to the answer you just gave.
 */
export function ProgressBanner({
  problems,
  skillsTotal,
}: {
  problems: Array<{ id: string; points: Points; skillIds: string[] }>;
  skillsTotal: number;
}) {
  const file = useProgress();
  const today = localDay(new Date());
  const p = bankProgress(file, problems, skillsTotal, today);
  const started = p.solved + p.attempted > 0;

  return (
    <section
      aria-labelledby="progress-heading"
      className="mt-6 rounded-md border border-rule bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="progress-heading" className="m-0 text-sm font-semibold text-ink">
          Your progress
        </h2>
        {started ? (
          <p className="m-0 text-xs text-ink-3">
            {p.solved} of {p.problems} solved, {p.skillsTouched} of {p.skillsTotal} skills opened
          </p>
        ) : (
          <p className="m-0 text-xs text-ink-3">
            Nothing yet. Solve one and this fills in. No account needed.
          </p>
        )}
        {p.streakDays > 0 ? (
          <span className="mono ml-auto rounded-lg border border-rule-strong bg-surface-2 px-2 py-0.5 text-2xs text-ink-2">
            {p.streakDays}-day streak
          </span>
        ) : null}
      </div>

      <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-3">
        {p.byTier.map((tier) => (
          <li key={tier.points}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="mono text-2xs text-ink-2">{tier.points} pt</span>
              <span className="mono text-2xs text-ink-3 tabular-nums">
                {tier.solved}/{tier.total}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${tier.points} point problems: ${tier.solved} of ${tier.total} solved.`}
              className="mt-1 h-2 overflow-hidden rounded-lg border border-rule-strong bg-surface-2"
            >
              <div className="h-full bg-m3" style={{ width: `${Math.round(tier.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 mb-0 text-2xs text-ink-3">
        Saved in this browser only. Nothing is sent anywhere and no account is required.
      </p>
    </section>
  );
}
