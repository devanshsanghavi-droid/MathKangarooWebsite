-- 001_profiles.sql
--
-- A profile is the smallest thing that can be a person on this site: a first name, a level, a
-- role and a language. There is deliberately nowhere to put a surname, a school, an address or
-- a birthday, because the users are children and a column that does not exist cannot leak.
--
-- Row level security is enabled here, with the table. Until 010_policies.sql adds a policy,
-- RLS with no policy means DENY EVERYTHING, so there is no window during a migration run in
-- which any row is readable.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) <= 24), -- first name only
  band text not null check (band in ('1-2', '3-4', '5-6', '7-8', '9-10', '11-12')),
  role text not null default 'student' check (role in ('student', 'mentor', 'author', 'admin')),
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

comment on table profiles is
  'One row per signed-in person. First name only: see docs/01-DATA-MODEL.md section 4.';
