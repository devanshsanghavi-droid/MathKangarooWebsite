import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentStats } from '@/lib/content';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why this exists: a tutor who kept doing the same diagnosis by hand for sixty students a ' +
    'year, and decided to make it into software.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  const stats = getContentStats();

  return (
    <div className="content-column px-4 py-10">
      <h1 className="m-0 text-2xl">About this site</h1>

      <div className="reading prose-measure mt-6 text-ink-2 [&>p]:mt-5 [&>p:first-child]:mt-0">
        <p className="text-lg text-ink">
          I tutor about sixty students a year for Math Kangaroo, and I kept running into the same
          wall.
        </p>
        <p>
          A student does a practice paper, scores 68 out of 120, and neither of us learns anything
          we can act on. &ldquo;Study more&rdquo; is not a diagnosis. I was doing the diagnosis in
          my head, every session, for every student, and it did not scale past the people sitting in
          front of me.
        </p>
        <p>So this site is that diagnosis, made into software.</p>
        <p>
          <strong className="text-ink">The Skill Atlas</strong> is the spine: {stats.skills} named
          skills - things like <em>counting by position</em>, <em>nets and folding</em>,{' '}
          <em>invariants</em> - grouped into seven strands and joined by prerequisite arrows. Each
          one has its own page: what it is, the phrases that tell you it is showing up in a problem,
          the mistakes students actually make, and a ladder of practice at the 3-, 4- and 5-point
          difficulties the real exam uses.
        </p>
        <p>
          <strong className="text-ink">The problem bank is entirely original</strong>, and that part
          matters enough to say out loud. Math Kangaroo&rsquo;s papers are copyrighted, so I do not
          host them. I link to their official free PDFs and publish my own{' '}
          <Link href="/papers">skill index</Link> of them - &ldquo;2019, level 5–6, question 22
          tests these two skills&rdquo;. Everything else here is a problem I wrote. That constraint
          is what made this real work rather than a link farm.
        </p>
        <p>
          <strong className="text-ink">
            The explanations are the part I have not seen anywhere else.
          </strong>{' '}
          Writing a problem is easy. The hard part is writing five answer choices where each wrong
          one comes from a real mistake a real student makes - and then storing that mistake next to
          the choice. So the feedback is written for <em>your</em> error, not the average one. There
          are {stats.misconceptions} of those explanations so far.
        </p>
      </div>

      <h2 className="mt-12 text-lg">What this will never do</h2>
      <ul className="prose-measure mt-3 grid list-none gap-2 p-0 text-ink-2">
        <li className="rounded-sm border-l-2 border-accent-600 bg-surface px-3 py-2">
          Charge for anything. There is no premium tier and there never will be.
        </li>
        <li className="rounded-sm border-l-2 border-accent-600 bg-surface px-3 py-2">
          Require an account to practise. Accounts exist only to save progress.
        </li>
        <li className="rounded-sm border-l-2 border-accent-600 bg-surface px-3 py-2">
          Track you. No ad networks, no third-party analytics, no cookies. The users are children.
        </li>
        <li className="rounded-sm border-l-2 border-accent-600 bg-surface px-3 py-2">
          Reproduce an official Math Kangaroo problem. Not the text, not a reword, not the figures.
        </li>
      </ul>

      <h2 className="mt-12 text-lg">It is open</h2>
      <p className="prose-measure mt-3 text-ink-2">
        The code is MIT and the content is CC BY-NC-SA. Everything is in{' '}
        <a href={SITE.repo} rel="noreferrer">
          one public repository
        </a>{' '}
        - including the problems, so anyone can check my work, correct a mistake, or run a Kangaroo
        club somewhere I will never visit. If you find an error in a problem, the fastest way to get
        it fixed is the report link at the bottom of that problem&rsquo;s page.
      </p>

      <h2 className="mt-12 text-lg">Who made it</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Devansh Sanghavi. You can <Link href="/contact">get in touch</Link> if you want to use this
        with your own students, tell me a problem is wrong, or ask how the taxonomy was built.
      </p>
    </div>
  );
}
