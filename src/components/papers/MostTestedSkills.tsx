import Link from 'next/link';
import type { SkillFrequency } from '@/lib/papers';
import { DifficultyPill } from '@/components/DifficultyPill';

/**
 * "Skills most tested in this band."
 *
 * A bar chart drawn in CSS rather than SVG, because every bar also has to be a row of readable
 * text: the number is stated next to the bar, so the chart is legible to a screen reader, in
 * black and white on a printed worksheet, and to anyone who cannot judge lengths by eye. The
 * bar is a reinforcement of the number, never the only carrier of it.
 */
export function MostTestedSkills({
  frequencies,
  skillNames,
  questionCount,
}: {
  frequencies: readonly SkillFrequency[];
  skillNames: ReadonlyMap<string, string>;
  questionCount: number;
}) {
  if (frequencies.length === 0) return null;
  const busiest = frequencies[0]?.count ?? 1;

  return (
    <div>
      <ol className="m-0 grid list-none gap-2 p-0">
        {frequencies.map((frequency) => (
          <li key={frequency.skillId}>
            <Link
              href={`/skill/${frequency.skillId}`}
              className="block rounded-sm px-2 py-1.5 no-underline hover:bg-surface-2"
            >
              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="mono text-2xs text-ink-3">{frequency.skillId}</span>
                <span className="flex-1 text-sm text-ink">
                  {skillNames.get(frequency.skillId) ?? 'Not in the Atlas'}
                </span>
                {frequency.points.map((points) => (
                  <DifficultyPill key={points} points={points} />
                ))}
                <span className="mono text-2xs text-ink-2">
                  {frequency.count} of {questionCount}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="mt-1 block h-1.5 rounded-full bg-accent-600"
                style={{ width: `${Math.max(4, (frequency.count / busiest) * 100)}%` }}
              />
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 mb-0 text-xs text-ink-3">
        A question tagged with two skills counts once for each, so these add up to more than the
        number of questions. That is the honest reading: the question really does test both.
      </p>
    </div>
  );
}
