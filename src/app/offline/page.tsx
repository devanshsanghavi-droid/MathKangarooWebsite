import type { Metadata } from 'next';
import Link from 'next/link';

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
    <div className="content-column px-4 py-16">
      <p className="mono m-0 text-xs text-ink-3">Offline</p>
      <h1 className="mt-2 text-2xl">You are not connected</h1>
      <p className="prose-measure mt-4 text-ink-2">
        This page has not been opened on this device before, so there is no copy saved. Anything you
        have already visited still works, and so do these:
      </p>
      <ul className="mt-6 flex flex-wrap list-none gap-4 p-0">
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/atlas">The Atlas</Link>
        </li>
        <li>
          <Link href="/problems">Browse problems</Link>
        </li>
      </ul>
      <p className="prose-measure mt-8 text-sm text-ink-3">
        Problems you have opened before are saved on this device and will still open. Nothing you do
        offline is lost: answers are kept locally and sent when the connection comes back.
      </p>
    </div>
  );
}
