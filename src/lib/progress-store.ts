import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseProgress, type ProgressFile } from './local-progress';

/**
 * Synced progress, one row per signed-in account, in Cloudflare D1 (binding `DB`, schema in
 * migrations/d1). The row holds an opaque account id (see accountIdFor in auth/google.ts), the
 * progress file as JSON, when it was last saved and when it was first created. Nothing else
 * about the student exists to store.
 */

/** The slice of the D1 API this file uses, so the code does not depend on workers-types. */
interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export async function progressDb(): Promise<D1Like | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { DB?: D1Like }).DB ?? null) as D1Like | null;
  } catch {
    // Not running on Cloudflare (unit tests, plain `next start`): syncing is simply off.
    return null;
  }
}

export async function loadProgress(db: D1Like, accountId: string): Promise<ProgressFile | null> {
  const row = await db
    .prepare('SELECT data FROM progress WHERE account_id = ?1')
    .bind(accountId)
    .first<{ data: string }>();
  return row ? parseProgress(row.data) : null;
}

export async function saveProgress(
  db: D1Like,
  accountId: string,
  file: ProgressFile,
): Promise<void> {
  const data = JSON.stringify(file);
  const now = Date.now();
  try {
    // created_at is written on the first insert only: the upsert branch leaves it alone, so
    // it stays the day the account first synced (counted on /admin, migrations/d1/0002).
    await db
      .prepare(
        'INSERT INTO progress (account_id, data, updated_at, created_at) VALUES (?1, ?2, ?3, ?3) ' +
          'ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      )
      .bind(accountId, data, now)
      .run();
  } catch (error) {
    // A database that has not had migration 0002 applied yet has no created_at column. Saving
    // a student's progress matters more than counting them, so fall back to the old statement
    // rather than failing the sync. Any other error is a real one.
    if (!(error instanceof Error) || !/created_at/.test(error.message)) throw error;
    await db
      .prepare(
        'INSERT INTO progress (account_id, data, updated_at) VALUES (?1, ?2, ?3) ' +
          'ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      )
      .bind(accountId, data, now)
      .run();
  }
}

export async function deleteProgress(db: D1Like, accountId: string): Promise<void> {
  await db.prepare('DELETE FROM progress WHERE account_id = ?1').bind(accountId).run();
}
