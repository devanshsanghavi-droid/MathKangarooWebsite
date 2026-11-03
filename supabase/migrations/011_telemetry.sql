-- 011_telemetry.sql
--
-- Product and learning analytics, stored so that no row can be traced to a person.
--
-- What makes that true is not this table's policies but the SHAPE of what reaches it:
-- src/lib/telemetry/events.ts admits only enumerated values drawn from content that is already
-- public - a skill id, a problem id, a choice key, a route name. There is no free-text column
-- here because there is no free-text field in the schema, and there never may be one. The
-- users are minors; COPPA is a build constraint, not a legal appendix.
--
-- `session_id` rotates with the browser tab and is stored in sessionStorage, so two visits by
-- the same child share nothing. That is a deliberate loss of analytical power: it makes a
-- classic retention cohort impossible, which is why props carries a coarse `returning` bucket
-- the CLIENT computes about itself instead.

create table telemetry_events (
  id bigserial primary key,
  name text not null,
  -- 16 hex chars, tab-scoped. Not a user id; there is no user id.
  session_id char(16) not null,
  seq integer not null check (seq >= 0),
  received_at timestamptz not null default now(),
  -- Enumerated values only. See the note above.
  props jsonb not null default '{}'::jsonb,
  schema_version smallint not null
);

-- Aggregation always slices by name and by time; nothing ever selects by session alone.
create index telemetry_events_name_time_idx on telemetry_events (name, received_at desc);
create index telemetry_events_session_idx on telemetry_events (session_id);
create index telemetry_events_props_idx on telemetry_events using gin (props);

alter table telemetry_events enable row level security;

-- Deny by default, as everywhere else in this schema. There is deliberately NO select policy:
-- nothing reads this table through the anon or authenticated roles. Writes arrive through the
-- service role in the collector, and aggregates are computed by a scheduled job that publishes
-- only figures with n >= 10 (docs/01-DATA-MODEL.md §4).

-- Ninety days is enough to calibrate an item and see a term's shape. Keeping it longer buys
-- nothing and grows the blast radius of any future mistake.
--
-- search_path is pinned EMPTY and every name is schema-qualified. A security definer function
-- runs with the owner's rights, so a resolvable bare name is a foothold: anyone able to
-- prepend a schema to the search path gets this function's privileges pointed at their table.
create or replace function prune_telemetry() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.telemetry_events where received_at < now() - interval '90 days';
$$;
