import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What we store (almost nothing), what we never store, and how to delete it. Written to be ' +
    'read by a parent, not by a lawyer.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="content-column px-4 py-10">
      <h1 className="m-0 text-2xl">Privacy</h1>
      <p className="prose-measure mt-3 mb-0 text-ink-3">
        This page is written to be read by a fifth grader&rsquo;s parent. If any of it is unclear,
        that is a bug — <Link href="/contact">tell me</Link> and I will rewrite it.
      </p>

      <h2 className="mt-10 text-lg">The short version</h2>
      <p className="prose-measure mt-3 text-ink-2">
        You can use everything on this site without an account. If you use it that way, we store
        nothing about you at all — no cookie, no identifier, nothing that comes back to you later.
      </p>

      <h2 className="mt-10 text-lg">If you do make an account</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Accounts exist for one reason: to remember what you have practised. Here is the complete
        list of what an account holds.
      </p>
      <ul className="prose-measure mt-4 grid list-none gap-2 p-0 text-ink-2">
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">A first name.</strong> Just the first name. A nickname is
          fine.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">A level</strong> (for example 5–6) and a language.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">Which problems were attempted</strong>, what was chosen, how
          long it took, and how many hints were opened.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">Which class</strong> a student belongs to, if a tutor set one
          up.
        </li>
        <li className="rounded-sm border border-rule bg-surface px-3 py-2">
          <strong className="text-ink">A parent&rsquo;s consent record</strong>, for students under
          13 who join through a class.
        </li>
      </ul>

      <h2 className="mt-10 text-lg">What we never store</h2>
      <p className="prose-measure mt-3 text-ink-2">
        No last name. No school. No address. No birthday. No photographs. No IP addresses in our
        analytics. No free text beyond a single 280-character reflection a student can choose to
        write about a problem they missed.
      </p>

      <h2 className="mt-10 text-lg">No trackers, no advertising, no cookies</h2>
      <p className="prose-measure mt-3 text-ink-2">
        There is no advertising on this site and there never will be. There are no third-party
        analytics, no social media pixels, and no cross-site identifiers. Usage statistics come from
        a self-hosted, cookie-free counter that records the page and nothing about the person. The
        only thing stored in your browser is your light-or-dark theme choice, which never leaves
        your device.
      </p>

      <h2 className="mt-10 text-lg">Getting your data back, or deleting it</h2>
      <p className="prose-measure mt-3 text-ink-2">
        From the settings page of any account you can export everything it holds as a single JSON
        file, or delete the account. Deletion is a real deletion: the rows are removed, not flagged
        as hidden, and nothing is kept in an archive. You do not have to ask us, and you do not have
        to give a reason.
      </p>

      <h2 className="mt-10 text-lg">Children</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Most people using this site are between about eight and eighteen. We treat COPPA as a design
        constraint rather than a legal appendix: the reason an account holds so little is that we do
        not want to be responsible for more. A student can join a tutor&rsquo;s class with a join
        code and a first name — no email address is needed from a child at any point. For students
        under 13 in a class, a parent&rsquo;s consent is recorded before any progress is saved.
      </p>

      <h2 className="mt-10 text-lg">Where the accounts live</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Account data is stored with Supabase, on Postgres, with row-level security so that one
        student&rsquo;s rows are unreadable to every other account, including other students in the
        same class. A tutor sees aggregate counts for their class, never another person&rsquo;s
        individual answers.
      </p>

      <h2 className="mt-10 text-lg">Contact</h2>
      <p className="prose-measure mt-3 text-ink-2">
        Questions about any of this go to <Link href="/contact">the contact page</Link>, or directly
        to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. The code that implements
        everything described here is{' '}
        <a href={SITE.repo} rel="noreferrer">
          public
        </a>
        , so you do not have to take my word for any of it.
      </p>
    </div>
  );
}
