-- 007_journal.sql
--
-- The one place a student writes free text. It is capped at 280 characters by a check
-- constraint rather than only in the UI, because docs/01-DATA-MODEL.md section 4 lists that cap
-- as part of the privacy posture, not as a form validation nicety.

create table journal_entries (
  id bigserial primary key,
  student_id uuid not null references profiles(id) on delete cascade,
  problem_id text not null,
  reflection text not null check (char_length(reflection) <= 280),
  resurface_on date not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index journal_entries_resurface_idx on journal_entries (student_id, resurface_on)
  where resolved = false;

alter table journal_entries enable row level security;
