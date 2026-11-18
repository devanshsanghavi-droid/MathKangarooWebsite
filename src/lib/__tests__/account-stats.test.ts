import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  ACCOUNT_STATS_SQL,
  accountStats,
  accountStatsOrNull,
  type D1StatsLike,
} from '../account-stats';
import { saveProgress } from '../progress-store';
import { EMPTY_PROGRESS } from '../local-progress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18, 12);

/** A fake D1 that records what it was asked and answers with a fixed row. */
function fakeDb(row: Record<string, unknown> | null) {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const db: D1StatsLike = {
    prepare(query) {
      return {
        bind(...values) {
          calls.push({ query, values });
          return {
            first: async <T>() => row as T | null,
          };
        },
      };
    },
  };
  return { db, calls };
}

describe('accountStats with a fake D1', () => {
  it('asks one aggregate query with the 7 and 30 day cut-offs', async () => {
    const { db, calls } = fakeDb({ total: 9, new7: 2, new30: 5, active7: 4, active30: 7 });
    const stats = await accountStats(db, NOW);
    expect(stats).toEqual({ total: 9, new7: 2, new30: 5, active7: 4, active30: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toBe(ACCOUNT_STATS_SQL);
    expect(calls[0]?.values).toEqual([NOW - 7 * DAY, NOW - 30 * DAY]);
  });

  it('selects counts only, never an id or a progress file', () => {
    expect(ACCOUNT_STATS_SQL).not.toMatch(/account_id|data\b/);
    expect(ACCOUNT_STATS_SQL).toMatch(/^SELECT COUNT\(\*\)/);
  });

  it('reads an empty table, or odd values, as zeros', async () => {
    expect(await accountStats(fakeDb(null).db, NOW)).toEqual({
      total: 0,
      new7: 0,
      new30: 0,
      active7: 0,
      active30: 0,
    });
    const odd = await accountStats(
      fakeDb({ total: '3', new7: null, new30: -1, active7: 'x', active30: 2.7 }).db,
      NOW,
    );
    expect(odd).toEqual({ total: 3, new7: 0, new30: 0, active7: 0, active30: 2 });
  });

  it('is null with no database, and null when the query fails', async () => {
    expect(await accountStatsOrNull(null, NOW)).toBeNull();
    const broken: D1StatsLike = {
      prepare() {
        throw new Error('no such column: created_at');
      },
    };
    expect(await accountStatsOrNull(broken, NOW)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Against real SQLite: the migrations, the insert-only created_at, the counts */
/* -------------------------------------------------------------------------- */

interface SqliteStatement {
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): unknown;
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

function loadSqlite(): (new (path: string) => SqliteDb) | null {
  try {
    const require = createRequire(import.meta.url);
    return (require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb })
      .DatabaseSync;
  } catch {
    return null;
  }
}

const DatabaseSync = loadSqlite();
const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'migrations', 'd1', name), 'utf8');

/** D1's prepare / bind / first / run over node:sqlite (D1 speaks the same ?1 placeholders). */
function d1Over(sqlite: SqliteDb) {
  return {
    prepare(query: string) {
      const statement = sqlite.prepare(query);
      return {
        bind(...values: unknown[]) {
          return {
            first: async <T>() => (statement.get(...values) ?? null) as T | null,
            run: async () => statement.run(...values),
          };
        },
      };
    },
  };
}

describe.skipIf(DatabaseSync === null)('migration 0002 and the store, on SQLite', () => {
  function freshDb(): SqliteDb {
    if (!DatabaseSync) throw new Error('unreachable: skipped without node:sqlite');
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migration('0001_progress.sql'));
    return sqlite;
  }

  it('backfills created_at from updated_at for rows that predate it', () => {
    const sqlite = freshDb();
    sqlite
      .prepare('INSERT INTO progress (account_id, data, updated_at) VALUES (?1, ?2, ?3)')
      .run('a', '{}', 1234);
    sqlite.exec(migration('0002_created_at.sql'));
    expect(sqlite.prepare('SELECT created_at FROM progress').get()).toEqual({ created_at: 1234 });
  });

  it('sets created_at on the first save and keeps it on every later save', async () => {
    const sqlite = freshDb();
    sqlite.exec(migration('0002_created_at.sql'));
    const db = d1Over(sqlite);
    const realNow = Date.now;
    try {
      Date.now = () => 1000;
      await saveProgress(db, 'acct', EMPTY_PROGRESS);
      Date.now = () => 5000;
      await saveProgress(db, 'acct', EMPTY_PROGRESS);
    } finally {
      Date.now = realNow;
    }
    expect(sqlite.prepare('SELECT created_at, updated_at FROM progress').get()).toEqual({
      created_at: 1000,
      updated_at: 5000,
    });
  });

  it('still saves on a database that has not had 0002 applied', async () => {
    const sqlite = freshDb();
    await saveProgress(d1Over(sqlite), 'acct', EMPTY_PROGRESS);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM progress').get()).toEqual({ n: 1 });
  });

  it('counts total, new and active accounts', async () => {
    const sqlite = freshDb();
    sqlite.exec(migration('0002_created_at.sql'));
    const insert = sqlite.prepare(
      'INSERT INTO progress (account_id, data, updated_at, created_at) VALUES (?1, ?2, ?3, ?4)',
    );
    insert.run('new-and-active', '{}', NOW - 1 * DAY, NOW - 2 * DAY);
    insert.run('old-but-active', '{}', NOW - 3 * DAY, NOW - 90 * DAY);
    insert.run('month-old', '{}', NOW - 20 * DAY, NOW - 20 * DAY);
    insert.run('dormant', '{}', NOW - 60 * DAY, NOW - 200 * DAY);
    expect(await accountStats(d1Over(sqlite), NOW)).toEqual({
      total: 4,
      new7: 1,
      new30: 2,
      active7: 2,
      active30: 3,
    });
  });
});
