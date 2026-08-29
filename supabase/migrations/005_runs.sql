-- 005_runs.sql   diagnostic / mock / triage sessions

create table runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('diagnostic', 'mock', 'triage')),
  band text not null check (band in ('1-2', '3-4', '5-6', '7-8', '9-10', '11-12')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer,
  max_score integer,
  -- Item order, flags and triage calls. Never free text from a student.
  payload jsonb
);

create index runs_student_idx on runs (student_id, started_at desc);

alter table runs enable row level security;
