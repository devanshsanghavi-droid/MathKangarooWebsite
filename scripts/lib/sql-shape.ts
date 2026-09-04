/**
 * A structural reader for the migration SQL.
 *
 * The real proof of row level security is `supabase/tests/rls.test.sql`, which needs a running
 * Postgres and is therefore not part of `pnpm test`. This module exists so that the *shape* of
 * the policies is still checked on every commit, with no database at all.
 *
 * It cannot prove that student A is unable to read student B's attempts — only a database can
 * do that. What it does catch is the failure that actually happens in practice: a table added
 * later with no `enable row level security`, a policy that quietly says `using (true)`, or a
 * `security definer` function without a pinned `search_path`. Those are silent, total, and
 * exactly the kind of thing a reviewer's eye slides over.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Policy {
  name: string;
  table: string;
  command: string;
  using: string | null;
  withCheck: string | null;
}

export interface SqlFunction {
  name: string;
  securityDefiner: boolean;
  searchPath: string | null;
  body: string;
}

export interface MigrationShape {
  tables: string[];
  rlsEnabled: string[];
  policies: Policy[];
  functions: SqlFunction[];
  revokedFromPublic: string[];
  sql: string;
}

/** Strip `--` line comments so a commented-out policy is never read as a real one. */
export function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const at = line.indexOf('--');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

export function readMigrations(dir: string): MigrationShape {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const sql = stripSqlComments(
    files.map((name) => readFileSync(join(dir, name), 'utf8')).join('\n'),
  );

  const tables = [
    ...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi),
  ].map((m) => m[1] ?? '');

  const rlsEnabled = [
    ...sql.matchAll(/alter\s+table\s+([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi),
  ].map((m) => m[1] ?? '');

  const policies: Policy[] = [
    ...sql.matchAll(
      /create\s+policy\s+([a-z_][a-z0-9_]*)\s+on\s+([a-z_][a-z0-9_]*)\s+for\s+([a-z]+)([\s\S]*?);/gi,
    ),
  ].map((m) => {
    const rest = m[4] ?? '';
    const usingMatch = /using\s*\(([\s\S]*?)\)\s*(?:with\s+check|$)/i.exec(rest);
    const checkMatch = /with\s+check\s*\(([\s\S]*)$/i.exec(rest);
    return {
      name: m[1] ?? '',
      table: m[2] ?? '',
      command: (m[3] ?? '').toLowerCase(),
      using: usingMatch?.[1]?.trim() ?? null,
      withCheck: checkMatch?.[1]?.trim().replace(/\)\s*$/, '') ?? null,
    };
  });

  const functions: SqlFunction[] = [
    ...sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+([a-z_.][a-z0-9_.]*)\s*\([\s\S]*?\$\$([\s\S]*?)\$\$/gi,
    ),
  ].map((m) => {
    const whole = m[0] ?? '';
    const header = whole.slice(0, whole.indexOf('$$'));
    const searchPath = /set\s+search_path\s*=\s*([^\s;]*)/i.exec(header)?.[1] ?? null;
    return {
      name: m[1] ?? '',
      securityDefiner: /security\s+definer/i.test(header),
      searchPath,
      body: m[2] ?? '',
    };
  });

  const revokedFromPublic = [
    ...sql.matchAll(
      /revoke\s+execute\s+on\s+function\s+([a-z_.][a-z0-9_.]*)\s*\([^)]*\)\s+from\s+public/gi,
    ),
  ].map((m) => m[1] ?? '');

  return { tables, rlsEnabled, policies, functions, revokedFromPublic, sql };
}

/** Tables holding one identifiable person's work. Nobody but the owner reads a row. */
export const STUDENT_OWNED_TABLES = ['attempts', 'mastery', 'runs', 'journal_entries'] as const;

/**
 * Tables with RLS enabled and deliberately no policy, which denies every client role.
 *
 * `telemetry_events` belongs here rather than with the student-owned tables because it has no
 * owner: rows carry a tab-scoped session id and no user id at all. Nothing reads it through
 * anon or authenticated — aggregates are computed by a job running as the service role, and
 * only figures with n >= 10 are ever published (docs/01-DATA-MODEL.md §4).
 */
export const SERVICE_ROLE_ONLY_TABLES = ['parent_consents', 'telemetry_events'] as const;
