import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { DeleteSyncedData } from './DeleteSyncedData';
import { currentSession } from '@/lib/auth/current';
import { googleConfig } from '@/lib/auth/google';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to save your progress across devices. Practice never requires an account.',
  // A sign-in page has nothing worth indexing and every reason not to be found.
  robots: { index: false, follow: false },
};

/** Reads a cookie, so it can never be prerendered. */
export const dynamic = 'force-dynamic';

const NOTICES: Record<string, string> = {
  google: 'Signing in with Google did not finish. Please try again.',
  'google-off': 'Signing in with Google is not switched on yet.',
  'signed-out': 'You are signed out. Your progress is still saved in this browser.',
  deleted: 'Your synced progress was deleted and you are signed out.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (session?.role === 'admin') redirect('/admin');

  const params = await searchParams;
  const notice =
    (typeof params.error === 'string' && NOTICES[params.error]) ||
    (params['signed-out'] ? NOTICES['signed-out'] : null) ||
    (params.deleted ? NOTICES.deleted : null);
  const googleOn = googleConfig() !== null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card padding="lg" className="rounded-[20px]">
        {session?.role === 'student' ? (
          <>
            <h1 className="m-0 text-2xl">You are signed in</h1>
            <p className="mt-3 mb-0 text-ink-2">
              Signed in with Google. Your progress syncs between every device where you sign in.
            </p>
            <form action="/api/auth/signout" method="post" className="mt-6">
              <button
                type="submit"
                className="ui inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-control border border-rule-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2"
              >
                Sign out
              </button>
            </form>
            <DeleteSyncedData />
          </>
        ) : (
          <>
            <h1 className="m-0 text-2xl">Sign in</h1>
            <p className="mt-3 mb-0 text-ink-2">
              Save your progress and pick up on any device. Signing in is optional: every problem
              works without it, and nothing is ever paywalled.
            </p>

            {notice ? (
              <p
                role="status"
                className="mt-5 mb-0 rounded-control border border-rule bg-surface-2 px-3 py-2 text-sm text-ink"
              >
                {notice}
              </p>
            ) : null}

            {googleOn ? (
              <a
                href="/api/auth/google"
                className="ui mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-control border border-rule-strong bg-surface px-4 text-base font-semibold text-ink no-underline hover:bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 18px brand mark */}
                <img src="/google-g.svg" alt="" width={18} height={18} />
                Continue with Google
              </a>
            ) : (
              <p className="mt-6 mb-0 text-sm text-ink-3">
                Google sign-in is not switched on yet. Your progress is saved in this browser in the
                meantime.
              </p>
            )}

            <p className="mt-4 mb-0 text-xs text-ink-3">
              We only ask Google for an anonymous account number: never your name, email or photo.{' '}
              <Link href="/legal/privacy">How sign-in works</Link>.
            </p>
          </>
        )}
      </Card>

      {session?.role === 'student' ? null : (
        <details className="mt-8 text-sm text-ink-2">
          <summary className="ui cursor-pointer font-semibold text-ink-2">Tutor sign-in</summary>
          <LoginForm />
        </details>
      )}
    </div>
  );
}
