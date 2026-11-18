-- When each synced-progress row was first created (src/lib/progress-store.ts), so /admin can
-- count new accounts. Set on insert only; updated_at still moves on every save. Rows that
-- predate this column are backfilled from updated_at, the best date they have.
ALTER TABLE progress ADD COLUMN created_at INTEGER;
UPDATE progress SET created_at = updated_at WHERE created_at IS NULL;
