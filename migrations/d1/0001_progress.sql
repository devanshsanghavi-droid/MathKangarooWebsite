-- Synced progress for students who sign in with Google (src/lib/progress-store.ts).
-- account_id is an HMAC of the Google subject, never an email or a name.
CREATE TABLE IF NOT EXISTS progress (
  account_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
