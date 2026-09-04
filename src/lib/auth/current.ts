import 'server-only';
import { cookies } from 'next/headers';
import { authConfig } from './config';
import { decodeSession, SESSION_COOKIE, type SessionPayload } from './session';

/** The signed-in session, or null. Never throws: an unreadable cookie is simply not signed in. */
export async function currentSession(): Promise<SessionPayload | null> {
  const secret = authConfig().sessionSecret;
  if (!secret) return null;
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value, secret, Math.floor(Date.now() / 1000));
}

export async function isAdmin(): Promise<boolean> {
  return (await currentSession())?.role === 'admin';
}
