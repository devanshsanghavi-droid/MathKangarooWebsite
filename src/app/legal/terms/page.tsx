import type { Metadata } from 'next';
import Link from 'next/link';
import { DISCLAIMER, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Plain terms for a free, open, non-commercial study site.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <div className="content-column px-4 py-10">
      <h1 className="m-0 text-2xl">Terms</h1>

      <h2 className="mt-10 text-lg">What this is</h2>
      <p className="prose-measure mt-3 text-ink-2">
        A free study site run by one person. It costs nothing, it has no premium tier, and it
        carries no advertising. Use it for as long as it is useful to you.
      </p>

      <h2 className="mt-10 text-lg">It is not affiliated with Math Kangaroo</h2>
      <p className="prose-measure mt-3 font-medium text-ink">{DISCLAIMER}</p>
      <p className="prose-measure mt-3 text-ink-2">
        &ldquo;Math Kangaroo&rdquo; is a trademark of Math Kangaroo in USA, NFP. It is used on this
        site descriptively, to say what the material prepares students for. No official problem,
        figure or answer is reproduced anywhere here; the <Link href="/papers">paper index</Link>{' '}
        holds our own analysis and links out to the official PDFs.
      </p>

      <h2 className="mt-10 text-lg">What you may do with the material</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Print it, hand it out, translate it, build on it — for teaching, for a club, for your own
        children. The problems and explanations are CC BY-NC-SA 4.0, which asks three things: credit
        the source, do not sell it, and share what you build under the same terms. The code is MIT.
        See the <Link href="/legal/license">licence page</Link>.
      </p>

      <h2 className="mt-10 text-lg">What you may not do</h2>
      <ul className="prose-measure mt-3 grid list-none gap-2 p-0 text-ink-2">
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          Sell the content, or put it behind a paywall.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          Present it as official Math Kangaroo material, or as endorsed by them.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          Use it to harass anyone, or attempt to reach another person&rsquo;s account data.
        </li>
      </ul>

      <h2 className="mt-10 text-lg">No guarantees</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Problems are written and reviewed by people, and people make mistakes. If an answer here is
        wrong, please report it from the problem&rsquo;s own page — every problem has a link that
        opens a public issue. Nothing on this site is a promise about how anyone will score on a
        real exam.
      </p>

      <h2 className="mt-10 text-lg">Availability</h2>
      <p className="prose-measure mt-3 text-ink-2">
        This runs on free hosting and could go down, change, or move. If it ever disappears, the
        whole thing — every problem, every explanation — stays available in the{' '}
        <a href={SITE.repo} rel="noreferrer">
          public repository
        </a>
        , which is deliberate.
      </p>

      <h2 className="mt-10 text-lg">Privacy</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Covered separately and in plain language on the{' '}
        <Link href="/legal/privacy">privacy page</Link>.
      </p>
    </div>
  );
}
