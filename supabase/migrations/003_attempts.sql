-- 003_attempts.sql
--
-- One row per answered problem. This is the most sensitive table on the site: it is a record
-- of what a named child got wrong. Nobody but the student reads a row of it - a mentor sees
-- counts through a security definer function and never the rows themselves.

create table attempts (
  id bigserial primary key,
  student_id uuid not null references profiles(id) on delete cascade,
  problem_id text not null,
  chosen_key char(1) not null check (chosen_key in ('A', 'B', 'C', 'D', 'E')),
  correct boolean not null,
  ms_elapsed integer not null check (ms_elapsed >= 0),
  hints_used smallint not null default 0 check (hints_used between 0 and 3),
  context text not null check (
    context in ('free', 'drill', 'diagnostic', 'mock', 'assignment', 'journal')
  ),
  run_id uuid,
  created_at timestamptz not null default now()
);

create index attempts_student_problem_idx on attempts (student_id, problem_id);
-- Powers scripts/calibrate.ts, which reads first attempts across all students.
create index attempts_problem_idx on attempts (problem_id);

alter table attempts enable row level security;
