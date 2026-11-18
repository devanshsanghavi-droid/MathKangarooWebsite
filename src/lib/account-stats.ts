/**
 * How many accounts exist, for /admin (docs/07 section 6). The only reason sign-in exists
 * beyond syncing is to know how many students use the site, and this is that number.
 *
 * Counts only. The query returns five integers and never an account id, a progress file or a
 * timestamp of any one account, so nothing here can be traced back to a student.
 *
 *   total      rows in `progress`: every account that has ever synced and not deleted its data
 *   new        created in the last 7 / 30 days (created_at, migrations/d1/0002)
 *   active     saved in the last 7 / 30 days (updated_at)
 */

export interface AccountStats {
  total: number;
  new7: number;
  new30: number;
  active7: number;
  active30: number;
}

/** The slice of the D1 API this file uses, so tests can pass a fake. */
export interface D1StatsLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
    };
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCOUNT_STATS_SQL =
  'SELECT COUNT(*) AS total, ' +
  'COALESCE(SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END), 0) AS new7, ' +
  'COALESCE(SUM(CASE WHEN created_at >= ?2 THEN 1 ELSE 0 END), 0) AS new30, ' +
  'COALESCE(SUM(CASE WHEN updated_at >= ?1 THEN 1 ELSE 0 END), 0) AS active7, ' +
  'COALESCE(SUM(CASE WHEN updated_at >= ?2 THEN 1 ELSE 0 END), 0) AS active30 ' +
  'FROM progress';

function count(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function accountStats(
  db: D1StatsLike,
  now: number = Date.now(),
): Promise<AccountStats> {
  const row = await db
    .prepare(ACCOUNT_STATS_SQL)
    .bind(now - 7 * DAY_MS, now - 30 * DAY_MS)
    .first<Record<keyof AccountStats, unknown>>();
  return {
    total: count(row?.total),
    new7: count(row?.new7),
    new30: count(row?.new30),
    active7: count(row?.active7),
    active30: count(row?.active30),
  };
}

/**
 * The stats, or null when there is no database to ask (local dev, `next start`, unit tests) or
 * the query fails (for example before migration 0002 is applied). The page says "not
 * available here" rather than showing a zero that looks like a real count.
 */
export async function accountStatsOrNull(
  db: D1StatsLike | null,
  now: number = Date.now(),
): Promise<AccountStats | null> {
  if (!db) return null;
  try {
    return await accountStats(db, now);
  } catch {
    return null;
  }
}
