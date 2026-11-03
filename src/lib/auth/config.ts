import 'server-only';

/**
 * Where the operator credential comes from, and why it is not in this file.
 *
 * ---------------------------------------------------------------------------------------
 * The repository is PUBLIC. A password written into tracked source is readable by anyone who
 * clones it, and stays readable in `git log` after it is changed - and behind this login sits
 * every piece of data the site holds about children. So the credential lives in the
 * environment: `.env.local` for development (gitignored) and a Cloudflare secret in
 * production. `scripts/hash-password.ts` prints the value to set.
 *
 * Even the environment variable holds a PBKDF2 hash rather than the password itself, so a
 * leaked deployment config does not hand over a working login.
 * ---------------------------------------------------------------------------------------
 */

export interface AuthConfig {
  adminUsername: string | null;
  adminPasswordHash: string | null;
  sessionSecret: string | null;
}

export function authConfig(): AuthConfig {
  return {
    adminUsername: process.env.ADMIN_USERNAME || null,
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
    sessionSecret: process.env.AUTH_SECRET || null,
  };
}

/** Admin sign-in is only possible when all three are set. Missing config denies, never allows. */
export function adminConfigured(config: AuthConfig = authConfig()): boolean {
  return Boolean(config.adminUsername && config.adminPasswordHash && config.sessionSecret);
}

/** Student accounts need Supabase, which also holds the profiles they would be stored in. */
export function studentAccountsConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
