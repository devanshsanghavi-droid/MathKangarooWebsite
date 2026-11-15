import type { Metadata } from 'next';
import { ButtonLink, Card, PageContainer } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * What a student sees when they open a page they have never visited and the network is gone.
 *
 * It names the pages that ARE cached rather than only apologising, because the useful thing to
 * know on a train is which links still work.
 */
export default function OfflinePage() {
  return (
    <PageContainer width="reading" className="sm:py-16">
      <Card padding="lg">
        <p className="mono m-0 text-xs text-ink-2">Offline</p>
        <h1 className="mt-2 mb-0 text-2xl sm:text-3xl">You are not connected</h1>
        <p className="prose-measure mt-4 mb-0 text-ink-2">
          This page has not been opened on this device before, so there is no copy saved. Anything
          you have already visited still works, and so do these:
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="primary">
            Practice
          </ButtonLink>
          <ButtonLink href="/atlas" variant="secondary">
            The Atlas
          </ButtonLink>
          <ButtonLink href="/problems" variant="secondary">
            Browse problems
          </ButtonLink>
        </div>
        <p className="prose-measure mt-6 mb-0 text-sm text-ink-2">
          Problems you have opened before are saved on this device and will still open. Nothing you
          do offline is lost: answers are kept locally and sent when the connection comes back.
        </p>
      </Card>
    </PageContainer>
  );
}
