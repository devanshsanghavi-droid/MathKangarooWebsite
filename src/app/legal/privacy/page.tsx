import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { SITE } from '@/lib/site';
import { Card, PageContainer } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What we store (almost nothing), what we never store, and how to delete it. Written to be ' +
    'read by a parent, not by a lawyer.',
  alternates: { canonical: '/legal/privacy' },
  // Boilerplate with no search intent behind it. It was competing with the home page
  // for the site's own name, so it stays reachable and linked but out of the index.
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <PageContainer width="reading">
      <p className="ui m-0 mb-2 text-xs font-semibold text-ink-2">Legal</p>
      <h1 className="m-0 text-2xl sm:text-3xl">Privacy</h1>
      <Card padding="lg" className="mt-6 [&>*:first-child]:mt-0">
        <p className="prose-measure mt-3 mb-0 text-ink-3">
          This page is written to be read by a fifth grader&rsquo;s parent. If any of it is unclear,
          that is a bug - <Link href="/contact">tell me</Link> and I will rewrite it.
        </p>

        <h2 className="mt-10 text-lg">The short version</h2>
        <p className="prose-measure mt-3 text-ink-2">
          You can use everything on this site without an account. If you use it that way, we store
          nothing about you at all - no cookie, no identifier, nothing that comes back to you later.
        </p>

        <h2 className="mt-10 text-lg">If you do make an account</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Accounts exist for one reason: to remember what you have practised. Here is the complete
          list of what an account holds.
        </p>
        <ul className="prose-measure mt-4 grid list-none gap-2 p-0 text-ink-2">
          <li className="rounded-control border border-rule bg-surface-2 px-3 py-2">
            <strong className="text-ink">A first name.</strong> Just the first name. A nickname is
            fine.
          </li>
          <li className="rounded-control border border-rule bg-surface-2 px-3 py-2">
            <strong className="text-ink">A level</strong> (for example 5-6) and a language.
          </li>
          <li className="rounded-control border border-rule bg-surface-2 px-3 py-2">
            <strong className="text-ink">Which problems were attempted</strong>, what was chosen,
            how long it took, and how many hints were opened.
          </li>
          <li className="rounded-control border border-rule bg-surface-2 px-3 py-2">
            <strong className="text-ink">Which class</strong> a student belongs to, if a tutor set
            one up.
          </li>
          <li className="rounded-control border border-rule bg-surface-2 px-3 py-2">
            <strong className="text-ink">A parent&rsquo;s consent record</strong>, for students
            under 13 who join through a class.
          </li>
        </ul>

        <h2 className="mt-10 text-lg">What we never store</h2>
        <p className="prose-measure mt-3 text-ink-2">
          No last name. No school. No address. No birthday. No photographs. No IP addresses in our
          analytics. No free text beyond a single 280-character reflection a student can choose to
          write about a problem they missed.
        </p>

        <h2 className="mt-10 text-lg">No trackers, no advertising</h2>
        <p className="prose-measure mt-3 text-ink-2">
          There is no advertising on this site and there never will be. There are no third-party
          analytics, no social media pixels, and no cross-site identifiers. Usage statistics come
          from a self-hosted, cookie-free counter that records the page and nothing about the
          person. Your theme choice and your progress are stored in your browser. If you sign in,
          two cookies keep you signed in: one the site cannot read from page scripts, and one that
          only says &ldquo;signed in&rdquo; so pages know to sync. Neither is shared with anyone.
        </p>

        <h2 className="mt-10 text-lg">Signing in with Google</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Signing in is optional and only syncs your progress between devices. We ask Google for one
          thing: an anonymous account number. We never ask for, and never receive, your name, email
          address or photo. We do not even store that number as it is: we scramble it with a secret
          key first, so the stored id cannot be matched back to a Google account. What is saved
          against it is the list of problems you tried, whether you got them right, how many hints
          you opened and when. Google accounts for children under 13 are run by a parent through
          Google, and Google may ask that parent before a child can sign in to a new site.
        </p>

        <h2 className="mt-10 text-lg">Getting your data back, or deleting it</h2>
        <p className="prose-measure mt-3 text-ink-2">
          From the settings page of any account you can export everything it holds as a single JSON
          file, or delete the account. Deletion is a real deletion: the rows are removed, not
          flagged as hidden, and nothing is kept in an archive. You do not have to ask us, and you
          do not have to give a reason.
        </p>

        <h2 className="mt-10 text-lg">Children</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Most people using this site are between about eight and eighteen. We treat COPPA as a
          design constraint rather than a legal appendix: the reason an account holds so little is
          that we do not want to be responsible for more. A student can join a tutor&rsquo;s class
          with a join code and a first name - no email address is needed from a child at any point.
          For students under 13 in a class, a parent&rsquo;s consent is recorded before any progress
          is saved.
        </p>

        <h2 className="mt-10 text-lg">Where synced progress lives</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Synced progress is stored in a Cloudflare D1 database, one row per signed-in account. The
          site only ever reads or writes the row belonging to the signed-in account. You can delete
          your row at any time from the sign-in page: the row is removed, not hidden.
        </p>

        <h2 className="mt-10 text-lg">Counting accounts</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Each row records when it was first created and when it was last saved. The site uses those
          two dates for one thing: counting how many accounts exist, how many are new and how many
          were used in the last week or month. Only the totals are ever shown, to the site&rsquo;s
          tutor, and no one account can be picked out of them. Deleting your row removes you from
          the count.
        </p>

        <h2 className="mt-10 text-lg">Contact</h2>
        <p className="prose-measure mt-3 text-ink-2">
          Questions about any of this go to <Link href="/contact">the contact page</Link>, or
          directly to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. The code that
          implements everything described here is{' '}
          <a href={SITE.repo} rel="noreferrer">
            public
          </a>
          , so you do not have to take my word for any of it.
        </p>
      </Card>
    </PageContainer>
  );
}
