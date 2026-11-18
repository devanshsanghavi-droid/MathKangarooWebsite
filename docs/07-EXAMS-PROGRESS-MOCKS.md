# 07 - More exams, progress analytics, mock and section tests

Approved by the owner on 2026-11-17. This extends `docs/06-V3-REDESIGN.md`; everything in 06
(static-route rule, visual language, authoring rules) still applies unless this file says
otherwise. CLAUDE.md non-negotiables still apply: original problems only, a misconception on
every wrong choice, alt text on every figure, practice never requires an account, no PII, no
trackers, WCAG AA, tokens-only colour.

## 1. Scope added

| Item | Summary |
|---|---|
| AMC 8 | Joins the AMC area as a third contest. 300 original problems. |
| SAT Math | New area `/sat`. 300 original problems. |
| ACT Math | New area `/act`. 300 original problems. |
| Kangaroo | 600 more original problems (100 per level), KA-1001..KA-1600. |
| Progress | `/progress`: performance by section, what needs practice, improvement over time. |
| Mock tests | Full timed mocks for AMC 8, AMC 10, AMC 12, SAT and ACT (Kangaroo mock exists). |
| Section tests | A short timed test on one section (strand / area / domain) for every bank. |
| User count | `/admin` shows how many accounts exist and how many are active. No PII. |

Official SAT, ACT and AMC problems are never reproduced. Disclaimers: SAT pages carry "SAT is
a trademark registered by the College Board, which is not affiliated with, and does not
endorse, this site."; ACT pages carry "ACT is a registered trademark of ACT Education Corp.,
which is not affiliated with, and does not endorse, this site." (the AMC/MAA disclaimer already
exists).

## 2. AMC 8

- `AMC_CONTESTS` gains `AMC8`. Folder `content/amc/problems/8/`. Ids `AM-1001`..`AM-1300`
  (the AM id space is shared; AMC 10/12 use AM-0001..AM-0999).
- Uses the existing taxonomy. Topics marked `amc12Only` never appear on AMC 8. Add a topic
  flag only if a needed middle-school topic is missing (e.g. basic data/statistics, unit
  conversion); keep it minimal.
- `slot` 1-25 as on AMC 10/12; tier and progress points derive from slot exactly as today.
- Formulas: `AmcFormulaContest` gains `AMC8`; tag only cards a middle-schooler would use.
- Real format for the mock: 25 questions, 40 minutes, 1 point per correct answer, no penalty.

## 3. SAT and ACT ("standardized tests")

One shared data layer for both, separate from AMC because the domains and choice counts differ.

- Schema `src/lib/test-schemas.ts`. Content `content/tests/<sat|act>/taxonomy.json` and
  `content/tests/<sat|act>/problems/<ID>.json`. Ids `SA-0001` (SAT), `AC-0001` (ACT).
- Taxonomy: domains -> skills. SAT domains: Algebra (ALG), Advanced Math (ADV), Problem-Solving
  and Data Analysis (PSD), Geometry and Trigonometry (GEO). ACT categories: Number and Quantity
  (NQ), Algebra (ALG), Functions (FUN), Geometry (GEO), Statistics and Probability (STAT). Skill
  ids `<DOMAIN>-NN`, namespaced per test (never looked up across tests or against Kangaroo/AMC).
- Problem: like `AmcProblemSchema` but `test`, `domain`, `skill`, `difficulty`
  (`easy|medium|hard`), exactly **4** choices (both tests use 4 choices; the enhanced ACT moved
  to 4 in 2025). No `slot`. Progress points: easy 3, medium 4, hard 5. Same misconception, hint,
  solution, figure, author, license rules. Calculator allowed on both, so problems may need one.
- **Assumption:** SAT student-produced-response (typed answer) questions are out for now; all
  SAT items are multiple choice. Noted so it can be revisited.
- Mock formats (non-adaptive): SAT 44 questions in 2 modules of 22, 35 minutes each (70 total),
  score shown as correct / 44 plus an approximate 200-800 band clearly labelled as an estimate.
  ACT 45 questions, 50 minutes, score correct / 45 plus an approximate 1-36 estimate, labelled.
- Distribution for authoring: SAT ~35% ALG, 35% ADV, 15% PSD, 15% GEO; ACT spread evenly across
  the five categories with a slight lean to ALG and FUN. Each third easy / medium / hard.

## 4. Routes

All static (generateStaticParams, `dynamicParams = false`), generateMetadata + OG, sitemap.

- `/sat`, `/act`: area home (what it is, counts by domain, start buttons for mock, section test,
  bank), `/sat/problems`, `/sat/problem/[id]`, `/sat/practice` (and the same under `/act`), reusing
  the shared bank layout and `PracticeSession` via a new adapter in `src/lib/practice-item.ts`.
- `/amc` gains the AMC 8 contest everywhere a contest filter or label exists.
- Mocks: `/amc/mock` (choose AMC 8 / 10 / 12), `/sat/mock`, `/act/mock`. Kangaroo stays at
  `/practice/mock`. One generic client engine (timer, navigator, flag for review, no-blank
  nudge, refresh-safe via localStorage) parameterised by an exam config; AMC 10/12 scoring
  6 / 1.5 / 0, AMC 8 1 / 0, SAT and ACT 1 per correct. Report: score, per-section accuracy,
  missed questions with their misconception and solution, three sections to work on.
- Section tests: `/practice/section` (Kangaroo: pick level + strand), `/amc/section`,
  `/sat/section`, `/act/section`. 10 questions from the chosen section, timer = sum of
  estSeconds rounded up to the minute, same report shape.
- `/progress`: works signed out from local progress; signed in, the synced copy. See section 5.
- Nav: add SAT, ACT and Progress. Mobile tab bar stays at 5 items, so exams go under a "More"
  or "Exams" entry; keep keyboard and screen-reader behaviour.

## 5. Progress analytics (`/progress`)

Client-rendered from the progress file (static page). Per bank tab (Kangaroo, AMC, SAT, ACT,
only tabs with attempts are enabled):

- **By section**: accuracy and attempts per strand / area / domain, then per skill / topic,
  as accessible bars with numbers.
- **Needs practice**: the weakest 3-5 sections with enough attempts (>= 5), each with a "Practice
  this" link into the section test.
- **Over time**: weekly accuracy line and weekly questions-answered bars (last 12 weeks), hand
  SVG with tokens, a data table alternative for screen readers.
- **Test history**: mock and section-test scores over time from `sessions` (below).
- Empty state that points to a first practice set. A gentle "Sign in to keep this on every
  device" link when not signed in. No streak pressure, no badges, no leaderboards.

Progress file change (backward compatible, merged by `progress-sync.ts`): optional
`sessions: Array<{ kind: 'mock' | 'section', exam: 'KA'|'AMC8'|'AMC10'|'AMC12'|'SAT'|'ACT',
section?: string, at: string, score: number, max: number, correct: number, total: number,
durationMs: number }>`, newest 100 kept, union by `kind|exam|at`. Every question answered in a
mock or section test is also recorded as a normal attempt.

SAT/ACT attempts live in the same file under keys `sat:<ID>` / `act:<ID>` style buckets, the
same way AMC uses `amcProgressKey`, so namespaces never collide.

## 6. User count (`/admin`)

D1 migration `0002`: add `created_at INTEGER` to `progress` (backfilled from `updated_at`).
`/admin` (tutor sign-in only) shows: total accounts, new in the last 7 and 30 days, active in
the last 7 and 30 days (by `updated_at`). Counts only; no ids are shown. The privacy page says
the site counts accounts.

## 7. Authoring

Same rules as docs/06 section 6 and docs/03: original mathematics, misconception in the
student's voice starting with "I" that produces exactly that value, graduated hints, reliable
(and elegant where natural) solution, every answer checked twice, Python brute force where
possible, independent verification pass on every batch. SAT/ACT items read like the real tests
(real-world contexts, data tables written as KaTeX arrays or plain lists, functions, systems,
percentages, geometry, trig) but are original. Figures only when essential, at most 2 per batch.
