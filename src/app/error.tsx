'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * The root error boundary. It shows the digest rather than the message: the digest is what
 * identifies the error in the server logs, and the message can contain internals a student has
 * no use for.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No PII in logs, per CLAUDE.md. The digest is an opaque hash, which is the point.
    console.error('Unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <p className="mono m-0 text-xs text-ink-3">Error</p>
      <h1 className="mt-2 text-2xl">Something went wrong on our side</h1>
      <p className="prose-measure mt-4 text-ink-2">
        Nothing you did caused this and nothing was lost. Try again, and if it keeps happening,
        please report it so it gets fixed.
      </p>
      {error.digest ? (
        <p className="mono mt-4 text-xs text-ink-3">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-sm border border-rule-2 bg-surface px-4 py-2 text-sm text-ink"
        >
          Try again
        </button>
        <Link href="/">Go home</Link>
      </div>
    </div>
  );
}
