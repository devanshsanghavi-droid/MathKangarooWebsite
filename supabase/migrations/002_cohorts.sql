-- 002_cohorts.sql
--
-- A cohort is a tutor's class. A student joins with a join code and a first name; no email
-- address is ever required from a child.

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mentor_id uuid not null references profiles(id) on delete cascade,
  join_code text unique not null,
  band text not null check (band in ('1-2', '3-4', '5-6', '7-8', '9-10', '11-12')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table cohort_members (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  consent_on_file boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (cohort_id, student_id)
);

create index cohort_members_student_idx on cohort_members (student_id);

alter table cohorts enable row level security;
alter table cohort_members enable row level security;
