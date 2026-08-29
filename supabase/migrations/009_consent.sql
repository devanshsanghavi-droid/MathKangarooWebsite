-- 009_consent.sql
--
-- Parent consent for under-13s joining through a cohort. This table is service-role only: RLS
-- is enabled and NO policy is ever written for it, which in Postgres means every ordinary
-- client role is denied unconditionally. The absence of a policy here is the security control,
-- so do not "fix" it by adding one.

create table parent_consents (
  student_id uuid primary key references profiles(id) on delete cascade,
  parent_email text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  token text unique not null
);

alter table parent_consents enable row level security;

comment on table parent_consents is
  'Service role only. RLS is enabled with no policy, which denies every client role.';
