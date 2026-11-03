/**
 * Password hashing and constant-time comparison, using only Web Crypto.
 *
 * Web Crypto rather than bcrypt/argon2 because this has to run on Cloudflare's workerd,
 * where there is no Node crypto and no native addon. PBKDF2-SHA256 is what SubtleCrypto
 * offers that is actually a password KDF; it is weaker than argon2id against dedicated
 * hardware, which is why the iteration count is set high rather than left at a default.
 *
 * The stored form is `pbkdf2.<iterations>.<salt-b64>.<hash-b64>`. Everything needed to verify
 * travels with the hash, so raising the iteration count later does not invalidate old hashes.
 *
 * The separator is a DOT, not the `$` that PHC-style hashes conventionally use, and that is
 * not cosmetic. This value lives in an environment variable, and `$` is variable-expansion
 * syntax to dotenv, to every POSIX shell and to docker-compose. With `$` separators, Next
 * loaded `pbkdf2$210000$<salt>$<hash>` and handed the application a NINE-character string:
 * everything from the first `$` had been expanded away to nothing. Sign-in then failed with
 * the correct password and the correct username, and failed identically to a wrong one,
 * because a malformed hash and a wrong password are the same answer. Base64 has no `.` in its
 * alphabet, so a dot cannot collide with the payload and nothing downstream reinterprets it.
 *
 * Nothing here ever handles a plaintext password that came from disk: `scripts/hash-password.ts`
 * produces the stored form once, and only that form is ever put in an environment variable.
 */

export const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

/** Produce the stored form. Used by scripts/hash-password.ts, never at request time. */
export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2.${iterations}.${toBase64(salt)}.${toBase64(hash)}`;
}

/**
 * Compare two byte strings without leaking, through timing, how far they matched.
 *
 * A `===` on secrets returns as soon as it finds a differing byte, and that difference is
 * measurable over enough requests. It matters more for the session signature than for the
 * password - a forged signature can be built a byte at a time, whereas a password guess still
 * has to pay for a PBKDF2 derivation.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  // Compare lengths without an early return: fold the difference into the accumulator.
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

/** Verify a candidate against the stored form. False on anything malformed - never throws. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number.parseInt(parts[1] ?? '', 10);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) return false;
  try {
    const salt = fromBase64(parts[2] ?? '');
    const expected = parts[3] ?? '';
    const actual = toBase64(await derive(password, salt, iterations));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * A well-formed hash of a value nobody can usefully submit, derived once and memoised.
 *
 * Its only job is to make a failed username lookup cost the same as a failed password check.
 * It lives here rather than beside the login action because a `'use server'` module may only
 * export async functions, and every function it exports becomes a callable server-action
 * endpoint - so a testable constant cannot live there without also becoming a public route.
 *
 * DERIVED, never a literal. The literal version of this was left in the old `$`-separated
 * form when the separator changed to a dot, and `verifyPassword` rejects a malformed hash
 * before it reaches the key derivation. The miss path therefore did no work at all: a wrong
 * username answered in microseconds while a correct one paid the full 210,000 iterations,
 * which is a ~1000x timing oracle for the operator's username. Producing it with the same
 * function that produces the real one means it cannot fall out of format again.
 */
let placeholder: Promise<string> | null = null;

export function placeholderHash(): Promise<string> {
  placeholder ??= hashPassword(`unusable-placeholder-${PBKDF2_ITERATIONS}`);
  return placeholder;
}
