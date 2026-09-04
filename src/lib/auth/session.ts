import { timingSafeEqual } from './password';

/**
 * Session cookies, signed with HMAC-SHA256 over Web Crypto.
 *
 * A signed cookie rather than a server-side session table because there is no database yet
 * and because the payload is three fields nobody needs to revoke individually. The trade is
 * explicit: a session cannot be killed server-side before it expires, so `MAX_AGE` is short
 * and rotating `AUTH_SECRET` invalidates every outstanding session at once.
 *
 * The payload carries no name, no email and no student identifier beyond an opaque subject —
 * a stolen cookie discloses a role and an expiry, and nothing about a child.
 */

export const SESSION_COOKIE = 'ka_session';
/** Eight hours: a tutoring session plus marking, and short enough that no revocation list is needed. */
export const MAX_AGE_SECONDS = 8 * 60 * 60;

export const ROLES = ['admin', 'student'] as const;
export type Role = (typeof ROLES)[number];

export interface SessionPayload {
  /** Opaque subject. 'admin' for the operator; an account id once students exist. */
  sub: string;
  role: Role;
  /** Unix seconds. */
  exp: number;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return base64url(new Uint8Array(signature));
}

export async function encodeSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

/**
 * Verify and decode. Returns null for anything that is not a currently-valid session —
 * a bad signature, a malformed body, an unknown role, or an expired token.
 *
 * The signature is checked BEFORE the payload is parsed, and the expiry is checked after.
 * Parsing first would run JSON.parse over attacker-controlled bytes for no reason.
 */
export async function decodeSession(
  token: string | undefined,
  secret: string,
  nowSeconds: number,
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await sign(body, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<SessionPayload>;
    if (typeof candidate.sub !== 'string' || candidate.sub.length === 0) return null;
    if (typeof candidate.exp !== 'number' || !Number.isFinite(candidate.exp)) return null;
    if (!ROLES.includes(candidate.role as Role)) return null;
    if (candidate.exp <= nowSeconds) return null;
    return { sub: candidate.sub, role: candidate.role as Role, exp: candidate.exp };
  } catch {
    return null;
  }
}

/** The Set-Cookie attributes. `secure` is dropped on localhost, where there is no TLS. */
export function cookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    // Lax, not None: the cookie must not ride along on a cross-site request. There is no
    // legitimate third-party context for this site.
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}
