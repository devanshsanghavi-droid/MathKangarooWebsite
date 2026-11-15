'use client';

import { useEffect } from 'react';
import { Button, ButtonLink, Card, PageContainer } from '@/components/ui';

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
    <PageContainer width="reading" className="sm:py-16">
      <Card padding="lg">
        <p className="mono m-0 text-xs text-ink-2">Error</p>
        <h1 className="mt-2 mb-0 text-2xl sm:text-3xl">Something went wrong on our side</h1>
        <p className="prose-measure mt-4 mb-0 text-ink-2">
          Nothing you did caused this and nothing was lost. Try again, and if it keeps happening,
          please report it so it gets fixed.
        </p>
        {error.digest ? (
          <p className="mono mt-4 mb-0 text-xs text-ink-2">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary">
            Go to Practice
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
