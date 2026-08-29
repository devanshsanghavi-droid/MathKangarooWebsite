import type { MasteryState } from '@/lib/mastery';
import { MASTERY_DISPLAY, MASTERY_LEGEND } from '@/lib/mastery-display';

/**
 * The unit page's progress bar: one segment per problem in the skill, plus a legend.
 *
 * The segments are the only mastery indicator on the site with no room for a glyph inside
 * them, which is why the ramp in tokens.css was respaced to even ~1.42:1 steps — at the
 * colours docs/05 §4 originally specified, "not started" and "familiar" were 1.01:1 apart and
 * this bar printed as one flat grey.
 *
 * The counts are written out underneath in words regardless. A bar is a summary; the sentence
 * is the thing that still works on a photocopy.
 */
export function MasteryBar({
  segments,
  label = 'Progress through this skill',
}: {
  segments: ReadonlyArray<{ problemId: string; state: MasteryState }>;
  label?: string;
}) {
  const counts = MASTERY_LEGEND.map((state) => ({
    state: state as MasteryState,
    count: segments.filter((segment) => segment.state === state).length,
  }));
  const done = segments.filter((segment) => segment.state === 'mastered').length;

  if (segments.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-3">
        No problems in this skill yet, so there is nothing to track.
      </p>
    );
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${done} of ${segments.length} problems solved cleanly.`}
        className="flex gap-0.5 overflow-hidden rounded-lg border border-rule-strong bg-surface p-0.5"
      >
        {segments.map((segment) => (
          <span
            key={segment.problemId}
            data-mastery={segment.state}
            title={`${segment.problemId} — ${MASTERY_DISPLAY[segment.state].label}`}
            className={`h-3 flex-1 rounded-xs ${MASTERY_DISPLAY[segment.state].fill}`}
          />
        ))}
      </div>

      <ul className="mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-ink-2">
        {counts.map(({ state, count }) => (
          <li key={state} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-xs border border-rule-strong ${MASTERY_DISPLAY[state].fill}`}
            />
            <span className="mono tabular-nums">{count}</span>
            <span>{MASTERY_DISPLAY[state].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
