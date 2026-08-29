# Database

Ten tables, all with row level security on and default deny. The rule the whole schema is built
around: **a student's rows are theirs, and nobody else reads them** — not another student, and
not a mentor. A mentor sees counts through a `security definer` function and never rows.

## Files

| File                          | What it holds                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `migrations/001`–`009`        | the tables from `docs/01-DATA-MODEL.md` §2, each followed immediately by `enable row level security` |
| `migrations/010_policies.sql` | every policy, plus the helper and aggregate functions                                                |
| `tests/rls.test.sql`          | the pgTAP proof of isolation — 40 assertions                                                         |

Policies are in `010` rather than beside their tables because they need helpers that read
across tables: a policy on `cohorts` that checks `cohort_members` and a policy on
`cohort_members` that checks `cohorts` recurse forever, and the way out is a `security definer`
function that can only be defined once every table exists. The deny-by-default half is still
with the tables — RLS with no policy denies everything, so no row is ever exposed mid-migration.

## Running it

```bash
supabase start
supabase db reset
supabase test db
```

`supabase test db` runs `tests/rls.test.sql`. It needs a running Postgres with pgTAP, so it is
**not** part of `pnpm test`.

`pnpm test` does run `scripts/__tests__/rls-shape.test.ts`, which reads the migration SQL and
checks its structure with no database at all: every table has RLS enabled in the same migration
that creates it, no policy is `using (true)`, the four student-owned tables are owner-only with
no mention of a mentor, `parent_consents` has no policy, and every `security definer` function
pins an empty `search_path` and re-checks the caller. That cannot prove isolation — only the
pgTAP file can — but it catches the failures that are silent, and it catches them on every commit.

## The two things most likely to be got wrong later

1. **Adding a table without RLS.** The shape test fails the build if you do.
2. **Adding a mentor policy to `attempts` or `mastery`** because a page needs the data. It will
   work, and it will hand over whole rows about a named child. Extend `cohort_skill_counts`
   instead — it returns counts, and the shape test forbids the word "mentor" in a policy on
   those tables.
