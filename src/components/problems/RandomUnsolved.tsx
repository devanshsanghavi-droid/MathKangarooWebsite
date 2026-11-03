'use client';

import { useState } from 'react';
import { readProgress } from '@/lib/local-progress';
import { bucketOf, statusOfProblem } from '@/lib/progress-summary';

/**
 * "Pick one for me", from whatever the filters currently show.
 *
 * Prefers a problem the student has never tried; once those run out, one they tried and
 * missed. The draw happens in the click handler, never during render, so the server and the
 * client agree on the markup and nothing random is ever cached.
 */
export function RandomUnsolved({
  candidates,
}: {
  candidates: ReadonlyArray<{ id: string; skillIds: readonly string[] }>;
}) {
  const [message, setMessage] = useState('');

  const pick = () => {
    const file = readProgress();
    const byBucket = (bucket: 'todo' | 'attempted') =>
      candidates.filter((c) => bucketOf(statusOfProblem(file, c.id, c.skillIds)) === bucket);
    const pool = byBucket('todo').length > 0 ? byBucket('todo') : byBucket('attempted');
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) {
      setMessage('You have solved every problem these filters match. Widen them for more.');
      return;
    }
    // A plain navigation rather than the app router, so this works in any tree that renders it.
    window.location.assign(`/problem/${chosen.id}`);
  };

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={pick}
        className="cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-3 py-1.5 text-sm font-medium text-ink hover:border-accent-700"
      >
        Pick a random unsolved problem
      </button>
      <p className="m-0 text-xs text-ink-3" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
