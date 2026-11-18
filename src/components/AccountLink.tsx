'use client';

import { useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import { readSignedInHint } from '@/lib/signed-in-hint';

const noop = () => () => {};

/**
 * The top-bar account control: "Sign in", or "Synced" once this browser holds a Google
 * sign-in. Both go to /login, which is also the account page. The server render (and so the
 * static HTML) always says "Sign in"; the hint cookie is read after hydration.
 */
export function AccountLink() {
  const signedIn = useSyncExternalStore(noop, readSignedInHint, () => false);
  return (
    <Link
      href="/login"
      className="ui inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-accent-700 no-underline hover:bg-accent-100"
    >
      {signedIn ? (
        <>
          <span aria-hidden="true">✓</span> Synced
          <span className="visually-hidden"> (account)</span>
        </>
      ) : (
        'Sign in'
      )}
    </Link>
  );
}
