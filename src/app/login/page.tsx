import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { currentSession } from '@/lib/auth/current';
import { studentAccountsConfigured } from '@/lib/auth/config';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to save your progress across devices. Practice never requires an account.',
  // A sign-in page has nothing worth indexing and every reason not to be found.
  robots: { index: false, follow: false },
};

/** Reads a cookie, so it can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if ((await currentSession())?.role === 'admin') redirect('/admin');

  return (
    <div className="content-column px-4 py-10">
      <h1 className="m-0 text-2xl">Sign in</h1>

      {/*
        CLAUDE.md's fourth non-negotiable, said on the page itself rather than only in the
        privacy policy: an account saves progress and does nothing else. Nothing is gated.
      */}
      <p className="reading prose-measure mt-3 mb-0 text-ink-2">
        Signing in saves your progress across devices. It is not required for anything - every
        problem, every ladder, every mock exam and the whole Atlas work without an account, and
        nothing here is ever paywalled.
      </p>

      <LoginForm />

      {studentAccountsConfigured() ? null : (
        <p className="mt-8 mb-0 max-w-prose text-sm text-ink-3">
          Student accounts are not open yet - they arrive with the progress database in Phase 2.
          Until then your work is saved in this browser, and{' '}
          <Link href="/legal/privacy">nothing about it leaves your device</Link>.
        </p>
      )}
    </div>
  );
}
