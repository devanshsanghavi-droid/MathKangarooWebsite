'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminConfigured, authConfig } from '@/lib/auth/config';
import { placeholderHash, timingSafeEqual, verifyPassword } from '@/lib/auth/password';
import { cookieOptions, encodeSession, MAX_AGE_SECONDS, SESSION_COOKIE } from '@/lib/auth/session';
import { GENERIC_FAILURE, type LoginState } from './login-state';

/**
 * Sign in.
 *
 * Three things this does deliberately:
 *
 *   One failure message.  Wrong username, wrong password, and unconfigured server all return
 *   the same sentence. Distinguishing them would confirm which usernames exist.
 *
 *   Constant work.  The PBKDF2 verification runs even when the username did not match, against
 *   a dummy hash. Otherwise a wrong username returns in a millisecond and a right one takes
 *   two hundred, and the difference enumerates the account.
 *
 *   Fails closed.  If ADMIN_USERNAME, ADMIN_PASSWORD_HASH or AUTH_SECRET is missing, nobody
 *   signs in. A misconfigured deployment locks the operator out; it does not let the world in.
 */

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  const config = authConfig();
  const configured = adminConfigured(config);
  const usernameMatches = configured && timingSafeEqual(username, config.adminUsername ?? '');

  // Always derive, so the timing of a wrong username matches that of a wrong password.
  const passwordMatches = await verifyPassword(
    password,
    (usernameMatches && config.adminPasswordHash) || (await placeholderHash()),
  );

  if (!configured || !usernameMatches || !passwordMatches) {
    return { error: GENERIC_FAILURE };
  }

  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    await encodeSession(
      { sub: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS },
      config.sessionSecret ?? '',
    ),
    cookieOptions(process.env.NODE_ENV === 'production'),
  );

  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}
