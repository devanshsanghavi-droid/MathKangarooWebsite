-- 008_sessions_log.sql   the mentor's own teaching record
--
-- Feeds the hours-of-instruction figure on /impact. Written by a mentor about their own
-- session, so it holds no student's answers - only who attended.

create table teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  held_on date not null,
  minutes integer not null check (minutes > 0),
  attendance uuid[] not null,
  skills_taught text[] not null,
  notes text
);

create index teaching_sessions_cohort_idx on teaching_sessions (cohort_id, held_on desc);

alter table teaching_sessions enable row level security;
