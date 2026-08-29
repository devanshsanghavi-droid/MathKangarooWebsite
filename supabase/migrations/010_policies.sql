-- 010_policies.sql
--
-- Every row level security policy, and the security definer helpers they need.
--
-- WHY THE POLICIES ARE NOT IN THE TABLE MIGRATIONS
--
-- docs/01-DATA-MODEL.md section 2.1 says to write the policies with the tables, not after, and
-- the deny-by-default half of that IS with the tables: every `create table` above is followed
-- immediately by `enable row level security`, and RLS with no policy denies everything. So at
-- no point during a migration run is any row readable by anyone.
--
-- The policies themselves live here because they need helper functions that read across
-- tables. A policy on `cohorts` that checks `cohort_members`, and a policy on `cohort_members`
-- that checks `cohorts`, recurse forever: evaluating one invokes the other, which invokes the
-- first. Postgres does not break that cycle for you. The fix is a `security definer` function,
-- which runs as its owner and therefore bypasses RLS on the tables it reads - and those
-- functions can only be defined once every table exists.
--
-- THE RULE FOR THIS FILE
--
-- A student's own rows are theirs. Nobody else reads them - not another student, and not a
-- mentor. A mentor sees COUNTS through the aggregate functions at the bottom, never rows.

-- ---------------------------------------------------------------------------
-- Helpers. All `security definer`, all with an empty search_path so that a
-- caller cannot shadow `public` with their own schema and change what they do.
-- ---------------------------------------------------------------------------

create or replace function public.is_cohort_mentor(target_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cohorts c
    where c.id = target_cohort and c.mentor_id = auth.uid()
  );
$$;

create or replace function public.is_cohort_member(target_cohort uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cohort_members m
    where m.cohort_id = target_cohort and m.student_id = auth.uid()
  );
$$;

-- True when the caller is the mentor of a cohort the given student belongs to. Used only to
-- decide whether a mentor may see a student's NAME and BAND - never their answers.
create or replace function public.mentors_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cohort_members m
    join public.cohorts c on c.id = m.cohort_id
    where m.student_id = target_student and c.mentor_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on profiles
  for select using (auth.uid() = id);

create policy profiles_insert_own on profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy profiles_delete_own on profiles
  for delete using (auth.uid() = id);

-- Deliberately NO mentor policy on profiles. Section 2.1 lets a mentor see a student's
-- display_name and band and "nothing else", and RLS is row-level: a row policy would expose
-- the whole row including role and locale. The roster function at the bottom returns exactly
-- those two columns instead.

-- ---------------------------------------------------------------------------
-- cohorts and membership
-- ---------------------------------------------------------------------------

create policy cohorts_mentor_all on cohorts
  for all using (mentor_id = auth.uid()) with check (mentor_id = auth.uid());

create policy cohorts_member_select on cohorts
  for select using (public.is_cohort_member(id));

create policy cohort_members_student_select on cohort_members
  for select using (student_id = auth.uid());

create policy cohort_members_mentor_select on cohort_members
  for select using (public.is_cohort_mentor(cohort_id));

create policy cohort_members_mentor_write on cohort_members
  for insert with check (public.is_cohort_mentor(cohort_id));

create policy cohort_members_mentor_delete on cohort_members
  for delete using (public.is_cohort_mentor(cohort_id));

-- A student may remove themselves from a class without asking anyone.
create policy cohort_members_student_leave on cohort_members
  for delete using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Student-owned data: attempts, mastery, runs, journal entries.
-- Owner-only, all four operations, no exceptions and no mentor path.
-- ---------------------------------------------------------------------------

create policy attempts_owner_select on attempts
  for select using (student_id = auth.uid());
create policy attempts_owner_insert on attempts
  for insert with check (student_id = auth.uid());
create policy attempts_owner_update on attempts
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy attempts_owner_delete on attempts
  for delete using (student_id = auth.uid());

create policy mastery_owner_select on mastery
  for select using (student_id = auth.uid());
create policy mastery_owner_insert on mastery
  for insert with check (student_id = auth.uid());
create policy mastery_owner_update on mastery
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy mastery_owner_delete on mastery
  for delete using (student_id = auth.uid());

create policy runs_owner_select on runs
  for select using (student_id = auth.uid());
create policy runs_owner_insert on runs
  for insert with check (student_id = auth.uid());
create policy runs_owner_update on runs
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy runs_owner_delete on runs
  for delete using (student_id = auth.uid());

create policy journal_owner_select on journal_entries
  for select using (student_id = auth.uid());
create policy journal_owner_insert on journal_entries
  for insert with check (student_id = auth.uid());
create policy journal_owner_update on journal_entries
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy journal_owner_delete on journal_entries
  for delete using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Mentor-owned data: assignments and teaching sessions. Members read.
-- ---------------------------------------------------------------------------

create policy assignments_mentor_all on assignments
  for all using (public.is_cohort_mentor(cohort_id))
  with check (public.is_cohort_mentor(cohort_id));

create policy assignments_member_select on assignments
  for select using (public.is_cohort_member(cohort_id));

create policy teaching_sessions_mentor_all on teaching_sessions
  for all using (public.is_cohort_mentor(cohort_id))
  with check (public.is_cohort_mentor(cohort_id));

-- No member policy on teaching_sessions: `notes` is the mentor's own writing about a lesson,
-- and section 2.1 lists the table as mentor-owned. Members read assignments, not lesson notes.

-- parent_consents: no policy at all, on purpose. See 009_consent.sql.

-- ---------------------------------------------------------------------------
-- The aggregate-only path for mentors.
--
-- These are the ONLY way a mentor sees anything derived from another person's rows, and they
-- return counts, never rows. Both are security definer, so they read past RLS - which is
-- exactly why each one re-checks that the caller really is the mentor of that cohort before
-- returning anything. Removing that check would turn either function into a data leak.
-- ---------------------------------------------------------------------------

create or replace function public.cohort_skill_counts(target_cohort uuid)
returns table (skill_id text, attempts bigint, correct bigint, students bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.skill_id,
    count(*)::bigint as attempts,
    count(*) filter (where a.correct)::bigint as correct,
    count(distinct a.student_id)::bigint as students
  from public.attempts a
  join public.mastery m on m.student_id = a.student_id
  join public.cohort_members cm on cm.student_id = a.student_id
  where cm.cohort_id = target_cohort
    and public.is_cohort_mentor(target_cohort)
  group by m.skill_id;
$$;

-- Roster: a mentor's class list. Exactly two columns about each student, which is what
-- section 2.1 permits - not the profile row.
create or replace function public.cohort_roster(target_cohort uuid)
returns table (student_id uuid, display_name text, band text, consent_on_file boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.band, cm.consent_on_file
  from public.cohort_members cm
  join public.profiles p on p.id = cm.student_id
  where cm.cohort_id = target_cohort
    and public.is_cohort_mentor(target_cohort);
$$;

-- Revoke the default EXECUTE-to-everyone on these, then grant only to signed-in users.
revoke execute on function public.cohort_skill_counts(uuid) from public;
revoke execute on function public.cohort_roster(uuid) from public;
grant execute on function public.cohort_skill_counts(uuid) to authenticated;
grant execute on function public.cohort_roster(uuid) to authenticated;
