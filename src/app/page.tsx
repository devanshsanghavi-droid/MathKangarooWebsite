import Link from 'next/link';
import { SITE } from '@/lib/site';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl sm:text-3xl">{SITE.tagline}</h1>
      <p className="prose-measure mt-5 text-lg text-ink-2">{SITE.description}</p>
      <ul className="mt-8 flex flex-wrap list-none gap-5 p-0">
        <li>
          <Link href="/atlas">Browse the Atlas</Link>
        </li>
        <li>
          <Link href="/problems">Practice a skill</Link>
        </li>
        <li>
          <Link href="/papers">Official paper index</Link>
        </li>
      </ul>
    </div>
  );
}
