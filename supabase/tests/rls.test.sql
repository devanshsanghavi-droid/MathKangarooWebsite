-- supabase/tests/rls.test.sql
--
-- Proves the isolation docs/01-DATA-MODEL.md section 2.1 requires. Run with:
--
--     supabase test db
--
-- It needs pgTAP and a running database, so it is NOT part of `pnpm test` - see the note in
-- STATUS.md. Everything it asserts about the SHAPE of the policies is additionally checked,
-- without a database, by scripts/__tests__/rls-shape.test.ts.
--
-- The users are minors. Treat any assertion in this file failing as a build failure, not as a
-- flaky test to skip.

begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Two students in the same cohort, and the mentor who teaches them.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'm@test.invalid'),
  ('44444444-4444-4444-4444-444444444444', 'x@test.invalid');

insert into profiles (id, display_name, band, role) values
  ('11111111-1111-1111-1111-111111111111', 'Ana', '5-6', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'Bo', '5-6', 'student'),
  ('33333333-3333-3333-3333-333333333333', 'Mentor', '5-6', 'mentor'),
  ('44444444-4444-4444-4444-444444444444', 'Outsider', '5-6', 'mentor');

insert into cohorts (id, name, mentor_id, join_code, band) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tuesday class',
   '33333333-3333-3333-3333-333333333333', 'JOIN-1', '5-6');

insert into cohort_members (cohort_id, student_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222');

insert into attempts (student_id, problem_id, chosen_key, correct, ms_elapsed, context) values
  ('11111111-1111-1111-1111-111111111111', 'KA-0001', 'C', true, 41000, 'free'),
  ('22222222-2222-2222-2222-222222222222', 'KA-0001', 'E', false, 52000, 'free');

insert into mastery (student_id, skill_id, state) values
  ('11111111-1111-1111-1111-111111111111', 'CNT-12', 'mastered'),
  ('22222222-2222-2222-2222-222222222222', 'CNT-12', 'shaky');

insert into runs (id, student_id, kind, band) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'mock', '5-6'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'mock', '5-6');

insert into journal_entries (student_id, problem_id, reflection, resurface_on) values
  ('11111111-1111-1111-1111-111111111111', 'KA-0001', 'Slide, do not split.', current_date + 7),
  ('22222222-2222-2222-2222-222222222222', 'KA-0001', 'Count the corners.', current_date + 7);

insert into parent_consents (student_id, parent_email, token) values
  ('11111111-1111-1111-1111-111111111111', 'parent@test.invalid', 'tok-1');

-- ---------------------------------------------------------------------------
-- Every table denies by default.
-- ---------------------------------------------------------------------------

select ok(relrowsecurity, format('%I has row level security enabled', relname))
from pg_class
where relname in (
  'profiles', 'cohorts', 'cohort_members', 'attempts', 'mastery',
  'runs', 'assignments', 'journal_entries', 'teaching_sessions', 'parent_consents'
)
order by relname;

-- ---------------------------------------------------------------------------
-- Student A sees their own rows and nobody else's.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111"}';

select is((select count(*) from attempts), 1::bigint,
  'student A sees exactly their own attempt');
select is((select count(*) from attempts where student_id <> auth.uid()), 0::bigint,
  'student A sees no other student''s attempts');
select is((select count(*) from mastery), 1::bigint,
  'student A sees exactly their own mastery row');
select is((select count(*) from runs), 1::bigint,
  'student A sees exactly their own run');
select is((select count(*) from journal_entries), 1::bigint,
  'student A sees exactly their own journal entry');
select is((select count(*) from profiles), 1::bigint,
  'student A sees exactly their own profile');
select is((select count(*) from parent_consents), 0::bigint,
  'student A cannot read the consent table at all');

-- A cannot write into B's rows even by naming B.
select throws_ok(
  $$ insert into attempts (student_id, problem_id, chosen_key, correct, ms_elapsed, context)
     values ('22222222-2222-2222-2222-222222222222', 'KA-0002', 'A', false, 1000, 'free') $$,
  '42501',
  null,
  'student A cannot write an attempt as student B'
);

select is((select count(*) from attempts
           where id in (select id from attempts where student_id <> auth.uid())), 0::bigint,
  'student A cannot update another student''s attempt into view');

-- ---------------------------------------------------------------------------
-- Student B, symmetrically.
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222"}';

select is((select count(*) from attempts), 1::bigint, 'student B sees exactly their own attempt');
select is((select count(*) from journal_entries), 1::bigint,
  'student B sees exactly their own journal entry');
select is((select count(*) from mastery where student_id <> auth.uid()), 0::bigint,
  'student B sees no other student''s mastery');

-- ---------------------------------------------------------------------------
-- The mentor. Sees the cohort, sees NO raw student rows, sees aggregates.
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333"}';

select is((select count(*) from cohorts), 1::bigint, 'the mentor sees their own cohort');
select is((select count(*) from cohort_members), 2::bigint,
  'the mentor sees the membership of their own cohort');

select is((select count(*) from attempts), 0::bigint,
  'THE CENTRAL ONE: a mentor reading attempts directly gets zero rows');
select is((select count(*) from mastery), 0::bigint,
  'a mentor reading mastery directly gets zero rows');
select is((select count(*) from runs), 0::bigint,
  'a mentor reading runs directly gets zero rows');
select is((select count(*) from journal_entries), 0::bigint,
  'a mentor reading journal entries directly gets zero rows');
select is((select count(*) from profiles), 1::bigint,
  'a mentor reading profiles directly sees only their own');
select is((select count(*) from parent_consents), 0::bigint,
  'a mentor cannot read the consent table');

-- ...but the aggregate path works, and returns counts rather than rows.
select ok(
  (select count(*) from public.cohort_skill_counts('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) > 0,
  'the mentor gets aggregate skill counts through the security definer function'
);
select is(
  (select students from public.cohort_skill_counts('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
   where skill_id = 'CNT-12'),
  2::bigint,
  'the aggregate counts both students in the cohort'
);
select is(
  (select count(*) from public.cohort_roster('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  2::bigint,
  'the mentor sees a two-name roster'
);

-- ---------------------------------------------------------------------------
-- A different mentor gets nothing, through either path.
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';

select is((select count(*) from cohorts), 0::bigint,
  'a mentor of another class sees no cohorts');
select is((select count(*) from cohort_members), 0::bigint,
  'a mentor of another class sees no memberships');
select is(
  (select count(*) from public.cohort_skill_counts('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  0::bigint,
  'the aggregate function returns nothing to a mentor who does not own the cohort'
);
select is(
  (select count(*) from public.cohort_roster('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  0::bigint,
  'the roster function returns nothing to a mentor who does not own the cohort'
);

-- ---------------------------------------------------------------------------
-- Deleting an account really deletes it.
-- ---------------------------------------------------------------------------

reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is((select count(*) from attempts where student_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'deleting the account cascades the attempts away');
select is((select count(*) from journal_entries where student_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'deleting the account cascades the journal away');
select is((select count(*) from parent_consents where student_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'deleting the account cascades the consent record away');

select * from finish();
rollback;
