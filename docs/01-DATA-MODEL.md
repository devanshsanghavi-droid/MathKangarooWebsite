# 01 — Data Model

Two stores, deliberately separated.

- **Content lives in git** (skills, problems, paper indexes, essays). Versioned, reviewable,
  backed up by definition, and it works with the database switched off.
- **Student data lives in Postgres** (Supabase). Small, private, deletable.

---

## 1. Content schemas — `src/lib/schemas.ts` (Zod)

### 1.1 Skill — `content/skills/<STRAND>/<ID>.json`

```ts
const Skill = z.object({
  id: z.string().regex(/^(NUM|CNT|GEO|LOG|PAT|MOD|CFT)-\d{2}$/),
  name: z.string().min(3).max(60),
  strand: z.enum(['NUM','CNT','GEO','LOG','PAT','MOD','CFT']),
  tier: z.enum(['foundation','core','gateway']),
  bands: z.array(z.enum(['1-2','3-4','5-6','7-8','9-10','11-12'])).min(1),
  definition: z.string().min(80).max(600),
  recognizeWhen: z.array(z.string()).min(3).max(6),
  canonicalProblem: z.string().nullable(),      // problem id
  misconceptions: z.array(z.string()).min(2),
  prerequisites: z.array(z.string()),            // skill ids
  unlocks: z.array(z.string()),                  // skill ids, derived + checked
  translations: z.record(z.string(), z.object({ name: z.string(), definition: z.string() })).optional(),
});
```

Validator must additionally assert: every prerequisite id exists; the prerequisite graph is
**acyclic**; `unlocks` is exactly the reverse of `prerequisites` (regenerate, never hand-edit).

### 1.2 Problem — `content/problems/<band>/<ID>.json`

```ts
const Choice = z.object({
  key: z.enum(['A','B','C','D','E']),
  text: z.string(),
  correct: z.boolean(),
  misconception: z.string().min(30).nullable(),  // required iff !correct
});

const Problem = z.object({
  id: z.string().regex(/^KA-\d{4}$/),
  band: z.enum(['1-2','3-4','5-6','7-8','9-10','11-12']),
  points: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  statement: z.string().min(20),
  figure: z.object({ component: z.string(), alt: z.string().min(20) }).nullable(),
  choices: z.array(Choice).length(5),
  skills: z.object({ primary: z.string(), secondary: z.array(z.string()) }),
  hints: z.tuple([z.string(), z.string(), z.string()]),   // nudge, strategy, full
  solutions: z.object({ reliable: z.string().min(50), elegant: z.string().nullable() }),
  whyOnTest: z.string().min(20).max(200),
  estSeconds: z.number().int().min(20).max(300),
  calibration: z.object({ pValue: z.number().nullable(), medianMs: z.number().nullable(), n: z.number() }),
  author: z.string(),
  reviewedBy: z.array(z.string()).min(1),
  createdAt: z.string().date(),
  license: z.literal('CC-BY-NC-SA-4.0'),
  translations: z.record(z.string(), z.object({ statement: z.string(), choices: z.array(z.string()) })).optional(),
});
```

Validator asserts: exactly one `correct: true`; every incorrect choice has a `misconception`;
`skills.primary` exists in the Atlas; the referenced figure component file exists; `alt` is
present whenever `figure` is; the id is unique across the repo.

### 1.3 Paper index — `content/papers/<year>-<band>.json`

**Contains no official problem text, figures, or answers.** Our analysis only.

```ts
const PaperIndex = z.object({
  year: z.number().int(),
  band: z.enum(['1-2','3-4','5-6','7-8','9-10','11-12']),
  officialPdfUrl: z.string().url(),      // mathkangaroo.org — always remote
  questions: z.array(z.object({
    number: z.number().int(),
    points: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    skills: z.array(z.string()).min(1),
    note: z.string().max(120).optional(),   // our one-line characterization, not the problem
  })),
});
```

A CI check greps the repo for any file over 2KB inside `content/papers/` and fails —
a defensive tripwire against someone pasting problem text in later.

---

## 2. Postgres — `supabase/migrations/`

```sql
-- 001_profiles.sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) <= 24), -- first name only
  band text not null,
  role text not null default 'student' check (role in ('student','mentor','author','admin')),
  locale text not null default 'en',
  created_at timestamptz default now()
);

-- 002_cohorts.sql
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mentor_id uuid not null references profiles(id) on delete cascade,
  join_code text unique not null,
  band text not null,
  archived boolean default false,
  created_at timestamptz default now()
);
create table cohort_members (
  cohort_id uuid references cohorts(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  consent_on_file boolean default false,
  joined_at timestamptz default now(),
  primary key (cohort_id, student_id)
);

-- 003_attempts.sql
create table attempts (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  problem_id text not null,
  chosen_key char(1) not null,
  correct boolean not null,
  ms_elapsed integer not null,
  hints_used smallint not null default 0,
  context text not null check (context in ('free','drill','diagnostic','mock','assignment','journal')),
  run_id uuid,
  created_at timestamptz default now()
);
create index on attempts (student_id, problem_id);
create index on attempts (problem_id);          -- powers calibration

-- 004_mastery.sql
create table mastery (
  student_id uuid references profiles(id) on delete cascade,
  skill_id text not null,
  state text not null default 'unseen' check (state in ('unseen','seen','shaky','mastered')),
  streak smallint default 0,
  stability real, difficulty real, due timestamptz,     -- FSRS fields
  updated_at timestamptz default now(),
  primary key (student_id, skill_id)
);

-- 005_runs.sql   diagnostic / mock / triage sessions
create table runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  kind text not null check (kind in ('diagnostic','mock','triage')),
  band text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  score integer, max_score integer,
  payload jsonb                                  -- item order, flags, triage calls
);

-- 006_assignments.sql
create table assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references cohorts(id) on delete cascade,
  title text not null,
  problem_ids text[] not null,
  due_on date,
  created_at timestamptz default now()
);

-- 007_journal.sql
create table journal_entries (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  problem_id text not null,
  reflection text not null check (char_length(reflection) <= 280),
  resurface_on date not null,
  resolved boolean default false,
  created_at timestamptz default now()
);

-- 008_sessions_log.sql   mentor's own teaching record
create table teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references cohorts(id) on delete cascade,
  held_on date not null,
  minutes integer not null,
  attendance uuid[] not null,
  skills_taught text[] not null,
  notes text
);

-- 009_consent.sql
create table parent_consents (
  student_id uuid primary key references profiles(id) on delete cascade,
  parent_email text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  token text unique not null
);
```

### 2.1 Row Level Security — write these with the tables, not after

- `profiles`: a user reads and updates only their own row. Mentors read `display_name` and
  `band` of students in their cohorts, nothing else.
- `attempts`, `mastery`, `runs`, `journal_entries`: owner-only read/write. Mentors get an
  **aggregate-only** path via a `security definer` function that returns counts per skill —
  never raw rows for another person.
- `cohorts`, `assignments`, `teaching_sessions`: mentor owns; members read.
- `parent_consents`: service role only.
- Default deny on every table. Write a `supabase/tests/rls.test.sql` proving each policy.

---

## 3. Derived logic — `src/lib/`

### 3.1 Mastery (`mastery.ts`)
```
unseen   → no attempt on any problem in this skill
seen     → ≥1 attempt
shaky    → attempted, accuracy < 70% over last 5, or a 4/5-point miss after a 3-point solve
mastered → 3 consecutive correct, across ≥2 distinct calendar days, with no hint above level 1
```
Mastery decays to `shaky` if the FSRS due date passes by more than 14 days.

### 3.2 Scheduling (`schedule.ts`)
`ts-fsrs` operates on the **skill**, not the problem. On each review the scheduler picks an
unseen problem in that skill at the student's current point-tier ceiling, so nothing is ever
answered from memory of the specific item.

### 3.3 Calibration (`scripts/calibrate.ts`)
Nightly GitHub Action: for every problem with `n >= 30` first-attempts, write back
`pValue` (proportion correct) and `medianMs` into the problem JSON, and open a PR.
Difficulty on the site is therefore *measured*, not asserted. Problems with a p-value above
0.95 or below 0.15 are flagged for rewrite.

### 3.4 Adaptive diagnostic (`diagnostic.ts`)
Start at two 3-point items in the student's band. On a miss, descend to a prerequisite skill;
on a solve, ascend to an unlocked skill and raise the point tier. Stop at 15 items or when the
frontier is bounded on all seven strands. Output: per-strand mastery estimate + an ordered
6-week plan of skills, weakest prerequisite first.

### 3.5 Scoring (`score.ts`)
Bands 1–2 and 3–4: 24 items, 8/8/8 at 3/4/5 points, max 96.
Bands 5–6 through 11–12: 30 items, 10/10/10, max 120.
No deduction for wrong answers — the UI must actively discourage blanks.

---

## 4. Privacy posture

- Store: first name, band, locale, attempts, mastery, cohort membership, consents.
- Never store: last name, school, address, birthdate, photos, free text beyond the 280-char
  journal reflection, IP addresses in analytics.
- `/me/settings` exports everything as JSON and hard-deletes on request (cascade, no soft delete).
- Analytics: self-hosted Umami, cookie-free, no cross-site identifiers.
- Anything on `/impact` is aggregate with `n >= 10`; never a figure that could identify one student.
