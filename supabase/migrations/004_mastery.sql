-- 004_mastery.sql
--
-- Mastery is per skill, not per problem: docs/01-DATA-MODEL.md section 3.2. The FSRS fields
-- live here because ts-fsrs schedules the SKILL and the server then serves an unseen problem
-- from it, so nothing is ever answered from memory of the specific item.

create table mastery (
  student_id uuid not null references profiles(id) on delete cascade,
  skill_id text not null,
  state text not null default 'unseen' check (state in ('unseen', 'seen', 'shaky', 'mastered')),
  streak smallint not null default 0,
  stability real,
  difficulty real,
  due timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

alter table mastery enable row level security;
