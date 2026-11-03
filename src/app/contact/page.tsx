import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { ContactForm } from './ContactForm';
import { isMailConfigured } from './actions';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch about using this with your own students, a problem that looks wrong, or how ' +
    'the taxonomy was built.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const mailConfigured = await isMailConfigured();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="m-0 text-2xl">Contact</h1>
      <p className="prose-measure mt-3 mb-0 text-ink-2">
        Good reasons to write: you want to use this with your own students, you think a problem is
        wrong, you disagree with where a skill sits in the Atlas, or you want to know how the
        taxonomy was built.
      </p>

      <div className="mt-8">
        <ContactForm mailConfigured={mailConfigured} />
      </div>

      <section aria-labelledby="other-ways" className="mt-10 border-t border-rule pt-6">
        <h2 id="other-ways" className="m-0 text-lg">
          Other ways, all of which work
        </h2>
        <ul className="mt-3 grid list-none gap-2 p-0 text-sm text-ink-2">
          <li>
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> - the same inbox the
            form writes to.
          </li>
          <li>
            <a href={`${SITE.repo}/issues`} rel="noreferrer">
              Open an issue
            </a>{' '}
            - best for anything about a specific problem, because the discussion stays attached to
            the fix.
          </li>
          <li>
            Every problem page has its own <Link href="/problems">report link</Link> that opens a
            prefilled issue with the id and file path already in it.
          </li>
        </ul>
      </section>
    </div>
  );
}
