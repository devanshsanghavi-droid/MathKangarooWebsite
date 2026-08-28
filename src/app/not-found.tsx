import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <p className="mono m-0 text-xs text-ink-3">404</p>
      <h1 className="mt-2 text-2xl">That page does not exist</h1>
      <p className="prose-measure mt-4 text-ink-2">
        The link may be out of date, or a skill or problem id may have been mistyped. Ids look like{' '}
        <code className="mono">GEO-10</code> for a skill and <code className="mono">KA-0001</code>{' '}
        for a problem.
      </p>
      <ul className="mt-6 flex flex-wrap list-none gap-4 p-0">
        <li>
          <Link href="/atlas">Browse the Atlas</Link>
        </li>
        <li>
          <Link href="/problems">Browse the problems</Link>
        </li>
        <li>
          <Link href="/">Go home</Link>
        </li>
      </ul>
    </div>
  );
}
