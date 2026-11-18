/**
 * "Continue with Google" - OpenID Connect, authorization-code flow with PKCE.
 *
 * ---------------------------------------------------------------------------------------
 * WHAT WE ASK GOOGLE FOR: NOTHING BUT AN ID
 *
 * The scope is `openid` and nothing else. No `email`, no `profile`. Google's ID token then
 * carries a `sub` - a stable, opaque number for the Google account - and no name, address,
 * photo or email. The site never sees who the student is, only that it is the same account as
 * last time. That keeps sign-in inside CLAUDE.md's "no PII beyond a first name" rule.
 *
 * Even the `sub` is not stored. `accountIdFor` turns it into an HMAC under AUTH_SECRET, so the
 * database holds an id that cannot be matched back to a Google account without the secret.
 *
 * WHY THE ID TOKEN'S SIGNATURE IS NOT CHECKED
 *
 * The token comes back from Google's token endpoint, over TLS, in exchange for a one-time code
 * plus our client secret and the PKCE verifier. OpenID Connect Core §3.1.3.7 (6) allows TLS
 * server validation in place of signature validation for exactly this case. The claims that
 * matter are still checked: issuer, audience, expiry and the nonce.
 * ---------------------------------------------------------------------------------------
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** The short-lived cookie that carries state, PKCE verifier, nonce and return path. */
export const OAUTH_COOKIE = 'ka_oauth';
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

/** Readable by page scripts on purpose: it tells static pages to sync. It holds no secret. */
export { HINT_COOKIE_NAME as SIGNED_IN_HINT_COOKIE } from '../signed-in-hint';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 32 random bytes, base64url: used for state, nonce and the PKCE verifier. */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Only same-site paths, so the return address cannot be turned into an open redirect. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export function buildAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: 'openid',
    state: options.state,
    nonce: options.nonce,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
    // Let the student pick an account every time: on a shared family or classroom computer,
    // silently reusing whoever signed in last is the wrong default.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** The cookie value: four dot-separated parts, none of which can contain a dot. */
export function encodeOauthCookie(parts: {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}): string {
  return [
    parts.state,
    parts.verifier,
    parts.nonce,
    base64url(new TextEncoder().encode(parts.next)),
  ].join('.');
}

export function decodeOauthCookie(
  value: string | undefined,
): { state: string; verifier: string; nonce: string; next: string } | null {
  if (!value) return null;
  const [state, verifier, nonce, next] = value.split('.');
  if (!state || !verifier || !nonce || next === undefined) return null;
  try {
    return { state, verifier, nonce, next: safeNext(base64urlDecode(next)) };
  } catch {
    return null;
  }
}

/**
 * Check the ID token's claims and return the Google subject, or null. See the header for why
 * the signature is not part of this.
 */
export function subjectFromIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string; nowSeconds: number },
): string | null {
  const [, body] = idToken.split('.');
  if (!body) return null;
  let claims: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(base64urlDecode(body));
    if (typeof parsed !== 'object' || parsed === null) return null;
    claims = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.has(claims.iss)) return null;
  const audienceOk = Array.isArray(claims.aud)
    ? claims.aud.includes(expected.clientId)
    : claims.aud === expected.clientId;
  if (!audienceOk) return null;
  if (typeof claims.exp !== 'number' || claims.exp <= expected.nowSeconds) return null;
  if (claims.nonce !== expected.nonce) return null;
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  return claims.sub;
}

export async function exchangeCode(options: {
  config: GoogleConfig;
  code: string;
  verifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.config.clientId,
      client_secret: options.config.clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: options.verifier,
    }).toString(),
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== 'object' || payload === null) return null;
  const idToken = (payload as { id_token?: unknown }).id_token;
  return typeof idToken === 'string' ? idToken : null;
}

/** The stored account id: an HMAC of the Google subject, prefixed so its origin is clear. */
export async function accountIdFor(subject: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`google:${subject}`));
  return `g_${base64url(new Uint8Array(mac)).slice(0, 32)}`;
}
