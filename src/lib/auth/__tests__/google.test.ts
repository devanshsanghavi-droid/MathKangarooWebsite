import { describe, expect, it, vi } from 'vitest';
import {
  accountIdFor,
  base64url,
  buildAuthUrl,
  decodeOauthCookie,
  encodeOauthCookie,
  exchangeCode,
  googleConfig,
  pkceChallenge,
  safeNext,
  subjectFromIdToken,
} from '../google';

function token(claims: Record<string, unknown>): string {
  const enc = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  return `${enc({ alg: 'RS256' })}.${enc(claims)}.signature`;
}

const NOW = 1_800_000_000;
const good = {
  iss: 'https://accounts.google.com',
  aud: 'client-123',
  exp: NOW + 600,
  nonce: 'n-1',
  sub: '1098765',
};
const expected = { clientId: 'client-123', nonce: 'n-1', nowSeconds: NOW };

describe('Google sign-in', () => {
  it('asks Google for openid only: no email, no profile', () => {
    const url = new URL(
      buildAuthUrl({
        clientId: 'client-123',
        redirectUri: 'https://kangarooatlas.com/api/auth/google/callback',
        state: 's',
        nonce: 'n',
        codeChallenge: 'c',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('computes the RFC 7636 S256 challenge', async () => {
    // The worked example from RFC 7636 Appendix B.
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('accepts a token with the right issuer, audience, expiry and nonce', () => {
    expect(subjectFromIdToken(token(good), expected)).toBe('1098765');
    expect(subjectFromIdToken(token({ ...good, iss: 'accounts.google.com' }), expected)).toBe(
      '1098765',
    );
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another audience', { aud: 'someone-else' }],
    ['an expired token', { exp: NOW - 1 }],
    ['a replayed nonce', { nonce: 'other' }],
    ['no subject', { sub: '' }],
  ])('rejects %s', (_label, change) => {
    expect(subjectFromIdToken(token({ ...good, ...change }), expected)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(subjectFromIdToken('not-a-token', expected)).toBeNull();
    expect(subjectFromIdToken('a.###.c', expected)).toBeNull();
  });

  it('round-trips the state cookie and keeps the return path same-site', () => {
    const value = encodeOauthCookie({ state: 's', verifier: 'v', nonce: 'n', next: '/amc' });
    expect(decodeOauthCookie(value)).toEqual({
      state: 's',
      verifier: 'v',
      nonce: 'n',
      next: '/amc',
    });
    const evil = encodeOauthCookie({
      state: 's',
      verifier: 'v',
      nonce: 'n',
      next: '//evil.example',
    });
    expect(decodeOauthCookie(evil)?.next).toBe('/');
    expect(decodeOauthCookie(undefined)).toBeNull();
    expect(decodeOauthCookie('only.two')).toBeNull();
  });

  it.each(['//evil.example', 'https://evil.example', '/\\evil', '', null])(
    'refuses %s as a return path',
    (raw) => {
      expect(safeNext(raw)).toBe('/');
    },
  );

  it('stores an HMAC of the subject, not the subject', async () => {
    const a = await accountIdFor('1098765', 'secret-one');
    expect(a).toMatch(/^g_[A-Za-z0-9_-]{32}$/);
    expect(a).not.toContain('1098765');
    expect(await accountIdFor('1098765', 'secret-one')).toBe(a);
    expect(await accountIdFor('1098765', 'secret-two')).not.toBe(a);
  });

  it('is off unless both the client id and secret are set', () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'x' })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' })).toEqual({
      clientId: 'x',
      clientSecret: 'y',
    });
  });

  it('sends the PKCE verifier when trading the code, and returns the id token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id_token: 'abc' })));
    const result = await exchangeCode({
      config: { clientId: 'x', clientSecret: 'y' },
      code: 'code-1',
      verifier: 'ver-1',
      redirectUri: 'https://kangarooatlas.com/api/auth/google/callback',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe('abc');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get('code_verifier')).toBe('ver-1');
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('returns null when Google refuses the code', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 400 }));
    expect(
      await exchangeCode({
        config: { clientId: 'x', clientSecret: 'y' },
        code: 'c',
        verifier: 'v',
        redirectUri: 'r',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});
