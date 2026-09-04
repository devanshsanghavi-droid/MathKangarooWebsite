import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `pnpm check:build-secrets` — fail the build if a credential got baked into the artifact.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * OpenNext's build runs Next's env loader, which reads `.env.local`, and writes the resolved
 * values verbatim into `.open-next/cloudflare/next-env.mjs`. wrangler then inlines that file
 * into the worker script it uploads. So an ordinary, non-NEXT_PUBLIC_ server-side secret in
 * `.env.local` ends up in plaintext inside the deployed bundle, with no warning — the
 * NEXT_PUBLIC_ convention that normally signals "this is going to be public" does not apply.
 *
 * It was worse than disclosure. `.open-next/cloudflare/init.js` does
 * `process.env[key] ??= nextEnvVars[mode][key]` AFTER binding the Cloudflare env, so a baked
 * value is used whenever the matching secret is absent. A deploy that forgot
 * `wrangler secret put` would not fail closed as `adminConfigured()` promises — it would
 * quietly authenticate against whatever was on the developer's laptop.
 *
 * And AUTH_SECRET alone is enough: `decodeSession` verifies an HMAC and nothing else, so
 * anyone able to read the deployed script can mint an admin cookie without the password.
 *
 * The fix is to keep these three out of every file Next's loader reads — they live in
 * `.dev.vars`, which wrangler reads and Next does not. This check is what stops that
 * arrangement from silently regressing.
 * ---------------------------------------------------------------------------------------
 */

/** Never permitted in a build artifact, under any circumstances. */
const FORBIDDEN_KEYS = [
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
  'AUTH_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/** A value that looks like one of our hashes, whatever key it is hiding under. */
const FORBIDDEN_SHAPES = [/pbkdf2\.\d{4,7}\./];

const ROOTS = ['.open-next', '.next'];
const SCAN_EXTENSIONS = /\.(mjs|js|cjs|json|html|txt|map)$/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

const hits: string[] = [];

for (const root of ROOTS) {
  for (const file of walk(join(process.cwd(), root))) {
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(process.cwd(), file);

    for (const key of FORBIDDEN_KEYS) {
      // A bare mention of the NAME is fine — `process.env.AUTH_SECRET` is how the code reads
      // it. What must never appear is the name bound to a literal value.
      const assigned = new RegExp(`["']${key}["']\\s*:\\s*["'][^"']+["']`);
      if (assigned.test(source)) hits.push(`${rel}: ${key} is present with a literal value`);
    }
    for (const shape of FORBIDDEN_SHAPES) {
      if (shape.test(source)) hits.push(`${rel}: contains something shaped like a password hash`);
    }
  }
}

if (hits.length === 0) {
  console.log('build secrets ok — no credential literal in .open-next or .next');
  process.exit(0);
}

console.error('CREDENTIALS BAKED INTO THE BUILD ARTIFACT:\n');
for (const hit of [...new Set(hits)]) console.error(`  ${hit}`);
console.error(
  '\nThese values would be uploaded inside the worker script and readable by anyone who can\n' +
    'read the deployment. Move them out of every .env file Next reads (use .dev.vars), delete\n' +
    '.open-next/, rebuild, and ROTATE anything that was already exposed.',
);
process.exit(1);
