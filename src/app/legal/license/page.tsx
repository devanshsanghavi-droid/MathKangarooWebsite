import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'License',
  description:
    'MIT for the code, CC BY-NC-SA 4.0 for the problems and explanations, and nothing at all ' +
    'for the official papers, which are not ours to license.',
  alternates: { canonical: '/legal/license' },
};

export default function LicensePage() {
  return (
    <div className="content-column px-4 py-10">
      <h1 className="m-0 text-2xl">License</h1>
      <p className="prose-measure mt-3 mb-0 text-ink-3">
        Two licences, because a website is two different things.
      </p>

      <h2 className="mt-10 text-lg">The code: MIT</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Everything under <code className="mono">src/</code> and{' '}
        <code className="mono">scripts/</code> is MIT licensed. Take it, change it, ship it, sell it
        if you like — the only condition is that the copyright notice travels with it. If you want
        to build a study site for a different competition, this is the half to fork.
      </p>

      <h2 className="mt-10 text-lg">The content: CC BY-NC-SA 4.0</h2>
      <p className="prose-measure mt-3 text-ink-2">
        The skill taxonomy, the problems, the answer choices and their misconceptions, the hints,
        the solutions, the paper indexes and the essays are licensed under the Creative Commons{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noreferrer">
          Attribution-NonCommercial-ShareAlike 4.0
        </a>{' '}
        licence.
      </p>
      <ul className="prose-measure mt-4 grid list-none gap-2 p-0 text-ink-2">
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">Attribution</strong> — credit &ldquo;{SITE.name}&rdquo; with
          a link back, and say if you changed something.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">NonCommercial</strong> — you may not sell it. Math Kangaroo
          preparation should not cost money; that is the whole reason this exists.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">ShareAlike</strong> — if you build on it, release your
          version under the same licence.
        </li>
      </ul>
      <p className="prose-measure mt-4 text-ink-2">
        Printing a worksheet for your class, translating a problem, or running a Kangaroo club from
        this material are all squarely allowed and actively encouraged.
      </p>

      <h2 className="mt-10 text-lg">What neither licence covers</h2>
      <p className="prose-measure mt-3 text-ink-2">
        <strong className="text-ink">The official Math Kangaroo problems.</strong> They are not in
        this repository, they never will be, and nothing here grants any right to them. They belong
        to Math Kangaroo in USA, NFP and to the Association Kangourou sans Frontières.
      </p>
      <p className="prose-measure mt-3 text-ink-2">
        The files under <code className="mono">content/papers/</code> are <em>our analysis</em> of
        official papers — a question number, a point value, our skill tags, and sometimes a short
        note in our own words. That analysis is ours and is covered by the content licence. The
        papers it describes are not ours and are not. See the{' '}
        <Link href="/papers">paper index</Link> for how that line is drawn, and{' '}
        <a href={`${SITE.repo}/blob/main/CONTENT-LICENSE`} rel="noreferrer">
          CONTENT-LICENSE
        </a>{' '}
        for the full text.
      </p>

      <h2 className="mt-10 text-lg">Trademark</h2>
      <p className="prose-measure mt-3 text-ink-2">
        &ldquo;Math Kangaroo&rdquo; is a trademark of Math Kangaroo in USA, NFP, used here
        descriptively only. This is an independent project and is not affiliated with, sponsored by,
        or endorsed by them.
      </p>
    </div>
  );
}
