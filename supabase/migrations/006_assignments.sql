-- 006_assignments.sql

create table assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  title text not null,
  problem_ids text[] not null,
  due_on date,
  created_at timestamptz not null default now()
);

create index assignments_cohort_idx on assignments (cohort_id);

alter table assignments enable row level security;
