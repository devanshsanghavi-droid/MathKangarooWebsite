import { describe, it, expect } from 'vitest';
import { hashPassword, placeholderHash, timingSafeEqual, verifyPassword } from '../password.ts';
import {
  cookieOptions,
  decodeSession,
  encodeSession,
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from '../session.ts';
import { adminConfigured } from '../config.ts';

const SECRET = 'test-secret-not-the-real-one';
const NOW = 1_800_000_000;

describe('password hashing', () => {
  it('round-trips the right password', async () => {
    const stored = await hashPassword('correct horse battery staple', 1000);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple', 1000);
    expect(await verifyPassword('Correct horse battery staple', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const a = await hashPassword('same', 1000);
    const b = await hashPassword('same', 1000);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('carries its own iteration count, so the cost can be raised without invalidating hashes', async () => {
    const stored = await hashPassword('x'.repeat(12), 1000);
    expect(stored.startsWith('pbkdf2.1000.')).toBe(true);
    expect(await verifyPassword('x'.repeat(12), stored)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['not-a-hash', 'unstructured'],
    ['pbkdf2.notanumber.c2FsdA==.aGFzaA==', 'non-numeric iterations'],
    ['pbkdf2.10.c2FsdA==.aGFzaA==', 'iteration count below the floor'],
    ['pbkdf2.210000.!!!notbase64!!!.aGFzaA==', 'corrupt salt'],
    ['bcrypt.210000.c2FsdA==.aGFzaA==', 'a different algorithm'],
    ['pbkdf2$210000$c2FsdA==$aGFzaA==', 'the old $-separated form, which dotenv destroys'],
  ])('returns false rather than throwing on %s (%s)', async (stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });
});

describe('the stored hash survives an environment variable', () => {
  it('contains no character that dotenv, a shell or docker-compose would expand', async () => {
    // The bug this guards: with `$` separators, Next handed the app a 9-character string -     // everything past the first `$` expanded to nothing - and the correct password was
    // rejected exactly like a wrong one.
    const stored = await hashPassword('a-long-enough-password', 1000);
    expect(stored).not.toContain('$');
    expect(stored).not.toContain('`');
    expect(stored.split('.')).toHaveLength(4);
    // And it still verifies after a literal round trip through an env-style assignment.
    const line = `ADMIN_PASSWORD_HASH=${stored}`;
    const readBack = line.slice(line.indexOf('=') + 1);
    expect(await verifyPassword('a-long-enough-password', readBack)).toBe(true);
  });
});

describe('the placeholder hash that equalises login timing', () => {
  /*
   * The bug this guards is the one an adversarial review found and five independent lenses
   * flagged: the placeholder was a hand-written literal in the old `$`-separated form, so
   * verifyPassword rejected it on its second line and never ran a derivation. The miss path
   * cost nothing while the hit path cost 210,000 iterations - a ~1000x timing oracle for the
   * operator's username, sitting directly under a comment claiming the opposite.
   *
   * Asserting `verifyPassword(x, placeholder) === false` would NOT have caught it: a malformed
   * hash and a wrong password both answer false. The shape is what has to be asserted.
   */
  it('is well-formed, so verification actually performs the key derivation', async () => {
    const hash = await placeholderHash();
    expect(hash.split('.')).toHaveLength(4);
    expect(hash.startsWith('pbkdf2.')).toBe(true);
    expect(hash).not.toContain('$');
  });

  it('carries the same iteration count as a real credential, so the cost matches', async () => {
    const [, placeholderIterations] = (await placeholderHash()).split('.');
    const [, realIterations] = (await hashPassword('a-real-password')).split('.');
    expect(placeholderIterations).toBe(realIterations);
  });

  it('is memoised, so the login path does not re-derive it on every request', async () => {
    expect(await placeholderHash()).toBe(await placeholderHash());
  });

  it('does not match a password anyone could submit', async () => {
    const hash = await placeholderHash();
    for (const guess of ['', 'password', 'admin', 'unusable-placeholder']) {
      expect(await verifyPassword(guess, hash), guess).toBe(false);
    }
  });
});

describe('constant-time comparison', () => {
  it('agrees with equality on the answer', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('does not return early on a length mismatch', () => {
    // A length check that returns early leaks the secret's length.
    expect(timingSafeEqual('short', 'a much longer value')).toBe(false);
    expect(timingSafeEqual('a much longer value', 'short')).toBe(false);
  });

  it('compares bytes, not code points, so multi-byte input cannot short-circuit', () => {
    expect(timingSafeEqual('é', 'é')).toBe(true);
    expect(timingSafeEqual('é', 'e')).toBe(false);
  });
});

describe('session tokens', () => {
  const payload = { sub: 'admin', role: 'admin' as const, exp: NOW + 3600 };

  it('round-trips a valid session', async () => {
    const token = await encodeSession(payload, SECRET);
    expect(await decodeSession(token, SECRET, NOW)).toEqual(payload);
  });

  it('REFUSES a token signed with a different secret', async () => {
    // Rotating AUTH_SECRET is the only revocation this design has; it has to actually work.
    const token = await encodeSession(payload, 'a-different-secret');
    expect(await decodeSession(token, SECRET, NOW)).toBeNull();
  });

  it('REFUSES a payload edited after signing', async () => {
    // The attack this scheme exists to stop: take a student token, rewrite the role, replay.
    const token = await encodeSession({ ...payload, role: 'student' }, SECRET);
    const [body, signature] = token.split('.');
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob((body as string).replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0),
        ),
      ),
    );
    expect(decoded.role).toBe('student');
    const forgedBody = btoa(JSON.stringify({ ...decoded, role: 'admin' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await decodeSession(`${forgedBody}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('refuses an expired session', async () => {
    const token = await encodeSession({ ...payload, exp: NOW - 1 }, SECRET);
    expect(await decodeSession(token, SECRET, NOW)).toBeNull();
  });

  it('refuses a role that is not in the allow-list', async () => {
    const token = await encodeSession(
      { ...payload, role: 'superuser' as unknown as 'admin' },
      SECRET,
    );
    expect(await decodeSession(token, SECRET, NOW)).toBeNull();
  });

  it.each([
    [undefined, 'a missing cookie'],
    ['', 'an empty cookie'],
    ['no-dot', 'no signature'],
    ['.', 'empty halves'],
    ['!!!.!!!', 'unparseable base64'],
    ['e30.e30', 'a valid shape with the wrong signature'],
  ])('returns null on %s (%s)', async (token, _why) => {
    await expect(decodeSession(token as string | undefined, SECRET, NOW)).resolves.toBeNull();
  });

  it('refuses everything when no secret is configured', async () => {
    const token = await encodeSession(payload, SECRET);
    expect(await decodeSession(token, '', NOW)).toBeNull();
  });
});

describe('the cookie', () => {
  it('is httpOnly and same-site, so script cannot read it and no third party sends it', () => {
    const options = cookieOptions(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(true);
    expect(options.maxAge).toBe(MAX_AGE_SECONDS);
    expect(SESSION_COOKIE).toBe('ka_session');
  });

  it('drops `secure` only on localhost, where there is no TLS to require', () => {
    expect(cookieOptions(false).secure).toBe(false);
  });
});

describe('configuration fails closed', () => {
  it.each([
    [{ adminUsername: null, adminPasswordHash: 'h', sessionSecret: 's' }, 'no username'],
    [{ adminUsername: 'u', adminPasswordHash: null, sessionSecret: 's' }, 'no password hash'],
    [{ adminUsername: 'u', adminPasswordHash: 'h', sessionSecret: null }, 'no session secret'],
    [{ adminUsername: null, adminPasswordHash: null, sessionSecret: null }, 'nothing set'],
  ])('refuses admin sign-in with %o (%s)', (config, _why) => {
    expect(adminConfigured(config)).toBe(false);
  });

  it('allows it only when all three are present', () => {
    expect(
      adminConfigured({ adminUsername: 'u', adminPasswordHash: 'h', sessionSecret: 's' }),
    ).toBe(true);
  });
});
