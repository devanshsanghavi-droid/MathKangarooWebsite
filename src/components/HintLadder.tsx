'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const HINT_LABELS = ['A nudge', 'The strategy', 'The full solution'] as const;

export const HINT_REVEAL_EVENT = 'ka:hint-reveal';

export interface HintRevealDetail {
  problemId: string;
  /** 1, 2 or 3. Matches the level recorded by POST /api/hint in Phase 2. */
  level: 1 | 2 | 3;
}

/**
 * Three hints, revealed one rung at a time.
 *
 * Each is a real <details>, so with JavaScript disabled all three still open — the content is
 * in the HTML, which matters more than enforcing the order. With JavaScript on, a rung refuses
 * to open until the one above it has been opened, and every reveal fires a
 * `ka:hint-reveal` CustomEvent on `window`. Phase 2 listens for that and posts it; nothing
 * here knows or cares whether anyone is listening.
 */
export function HintLadder({
  problemId,
  hints,
  onReveal,
}: {
  problemId: string;
  hints: readonly [string, string, string];
  onReveal?: (detail: HintRevealDetail) => void;
}) {
  const [revealed, setRevealed] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const announced = useRef(new Set<number>());

  // Only gate the ladder once we know JavaScript is running. Rendering the gated state on the
  // server would hide hints from a reader whose JS never arrives.
  useEffect(() => setEnhanced(true), []);

  const reveal = useCallback(
    (level: 1 | 2 | 3) => {
      setRevealed((current) => Math.max(current, level));
      if (announced.current.has(level)) return;
      announced.current.add(level);
      const detail: HintRevealDetail = { problemId, level };
      onReveal?.(detail);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<HintRevealDetail>(HINT_REVEAL_EVENT, { detail }));
      }
    },
    [onReveal, problemId],
  );

  return (
    <section aria-labelledby={`hints-${problemId}`} className="mt-6">
      <h3 id={`hints-${problemId}`} className="m-0 text-sm font-semibold text-ink">
        Hints
      </h3>
      <p className="mt-1 mb-3 text-xs text-ink-3">
        Take them one at a time. The first gives nothing away.
      </p>

      <ol className="m-0 grid list-none gap-2 p-0">
        {hints.map((hint, index) => {
          const level = (index + 1) as 1 | 2 | 3;
          const locked = enhanced && revealed < index;

          return (
            <li key={level}>
              <details
                open={enhanced ? revealed >= level : undefined}
                data-level={level}
                className={[
                  'rounded-sm border px-3 py-2',
                  locked ? 'border-rule bg-surface-2 opacity-60' : 'border-rule bg-surface',
                ].join(' ')}
                onToggle={(event) => {
                  if ((event.currentTarget as HTMLDetailsElement).open) reveal(level);
                }}
              >
                <summary
                  aria-disabled={locked || undefined}
                  className={[
                    'text-sm font-medium text-ink marker:text-ink-3',
                    locked ? 'cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                  onClick={(event) => {
                    if (!locked) return;
                    // Refuse to jump the ladder, and say why rather than doing nothing.
                    event.preventDefault();
                  }}
                >
                  <span className="mono mr-2 text-2xs text-ink-3">{level}</span>
                  {HINT_LABELS[index]}
                  {locked ? (
                    <span className="ml-2 text-xs font-normal text-ink-3">
                      — open hint {level - 1} first
                    </span>
                  ) : null}
                </summary>
                <p className="prose-measure mt-2 mb-1 text-sm text-ink-2">{hint}</p>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
