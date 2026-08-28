# 02 — Build Plan

Every part of the website, in build order. Each **milestone** is sized for one Claude Code
session. Work top to bottom; don't start a milestone until the one above it is green.

Anchor date: **Math Kangaroo falls on the third Thursday in March.** Everything in Phases 1–2
must be in front of real students before then.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

# PHASE 0 — Foundations (Sep 2026, ~2 weeks)
*No product code. Get the thinking and the rails right first.*

## M0.1 — Taxonomy v1
- [ ] Write all 91 skill JSON files from `docs/03-CONTENT-GUIDE.md` Part A
- [ ] Fill `definition`, `recognizeWhen`, `misconceptions` for every skill (this is the work)
- [ ] Draw the prerequisite edges; confirm the graph is acyclic
- [ ] Classify three full official past papers against the taxonomy on paper
- [ ] Every problem you couldn't classify becomes a new skill node or a note in a backlog file
- [ ] Generate `unlocks` from `prerequisites` with a script; never hand-write it
**Acceptance:** 91 files validate; DAG has no cycles; ≥95% of three papers' questions map to a skill.

## M0.2 — Repo and rails
- [ ] `pnpm create next-app` — TypeScript, App Router, Tailwind v4, ESLint
- [ ] `tsconfig` strict; path alias `@/*`
- [ ] Prettier + ESLint config, `.editorconfig`, `.nvmrc`
- [ ] `src/styles/tokens.css` with the full light/dark token set from `docs/00-SPEC.md` §0.1
- [ ] Zod schemas in `src/lib/schemas.ts` for Skill, Problem, PaperIndex
- [ ] `scripts/validate-content.ts` + `pnpm validate:content`
- [ ] Vitest set up with one passing test
- [ ] GitHub Actions: install → typecheck → lint → test → validate:content → build
- [ ] Branch protection on `main`: CI must pass
- [ ] `LICENSE` (MIT for code) and `CONTENT-LICENSE` (CC BY-NC-SA 4.0 for content)
- [ ] `README.md` explaining what this is and how to run it
- [ ] Vercel project connected, preview deploys on every PR
**Acceptance:** an empty commit to a branch runs green CI and produces a preview URL.

## M0.3 — Content guardrails in CI
- [ ] Fail build if any incorrect choice lacks a `misconception`
- [ ] Fail build if any problem with a figure lacks `alt`
- [ ] Fail build if any file in `content/papers/` exceeds 2KB (anti-paste tripwire)
- [ ] Fail build on duplicate problem or skill ids
- [ ] Fail build on a broken skill reference from any problem
**Acceptance:** each rule has a fixture that proves it fails, and a fixture that proves it passes.

## M0.4 — Legal and naming, before anything is public
- [ ] Footer disclaimer component: *"Independent project. Not affiliated with or endorsed by Math Kangaroo in USA, NFP."*
- [ ] Draft `/legal/privacy`, `/legal/terms`, `/legal/license` copy
- [ ] Write (don't necessarily send yet) a short, friendly note to Math Kangaroo USA describing the project
- [ ] Decide public name and lock it across the repo
**Acceptance:** disclaimer renders on every page from the first deploy onward.

---

# PHASE 1 — The static core (Oct–Nov 2026, ~6 weeks)
*Ship a genuinely useful site with no database. Hand it to your own students the day it's live.*

## M1.1 — App shell
- [ ] Root layout, font loading, theme tokens wired
- [ ] `<Header>` with nav + `<ThemeToggle>` (light/dark/system, persisted)
- [ ] `<Footer>` with license, GitHub, privacy, disclaimer
- [ ] Mobile bottom tab bar
- [ ] `<SkipLink>`, focus-visible styles, `prefers-reduced-motion` global rule
- [ ] `not-found.tsx`, `error.tsx`, `loading.tsx`
- [ ] `robots.txt`, `sitemap.xml`, favicon, web manifest
**Acceptance:** axe reports zero violations on the empty shell in both themes.

## M1.2 — Content loading layer
- [ ] `src/lib/content.ts` — typed loaders for skills, problems, papers, with build-time caching
- [ ] Derived indexes: problems-by-skill, skills-by-strand, skills-by-band, prerequisite graph
- [ ] Unit tests for every loader and index
**Acceptance:** loaders are pure, synchronous at build time, and typed with no `any`.

## M1.3 — Core problem components
- [ ] `<PointPill>`, `<BandPill>`, `<SkillChip>`
- [ ] `<FigureRenderer>` — resolves a figure component by id, renders alt text
- [ ] `<ChoiceList>` — five buttons, keyboard operable, `aria-pressed`
- [ ] `<FeedbackPanel>` — renders the misconception for the chosen key, or the correct explanation
- [ ] `<HintLadder>` — three levels, revealed one at a time, each reveal emits an event
- [ ] `<SolutionTabs>` — reliable / elegant, elegant hidden when null
- [ ] `<ProblemCard>` — composes the above
- [ ] Render tests for all of the above, light and dark
**Acceptance:** with JS disabled, statement + choices + a `<details>` solution still render.

## M1.4 — `/problem/[id]`
- [ ] Full problem page per `docs/00-SPEC.md` §1.6
- [ ] Metadata row, skill chips, "why this is on the test"
- [ ] Next/previous within the same skill
- [ ] Report-a-problem link → prefilled GitHub issue
- [ ] `generateStaticParams` for every problem; OG image per problem
**Acceptance:** every problem in `content/` builds a static page.

## M1.5 — `/skill/[id]`
- [ ] All nine sections from `docs/00-SPEC.md` §1.4
- [ ] Prerequisite and unlocks chips, linked
- [ ] Practice ladder grouped by point value
- [ ] "In official papers" section reading from the paper index
- [ ] Canonical worked example rendered inline
**Acceptance:** every one of the 91 skills renders without a missing-section placeholder.

## M1.6 — The Atlas
- [ ] Graph layout algorithm (deterministic; layer by tier, group by strand)
- [ ] `<AtlasGraph>` — SVG, pan + zoom, click to focus, URL state
- [ ] `<AtlasList>` — full nested-list equivalent, keyboard-first, used by screen readers
- [ ] Strand visibility toggles, band filter, "has problems" filter
- [ ] Side panel with skill summary
- [ ] `/atlas/[strand]` ordered walkthrough pages
**Acceptance:** every skill reachable by keyboard alone; graph and list show identical sets.

## M1.7 — `/problems` browse
- [ ] Filter bar: band, points, strand, skill, source
- [ ] URL-encoded state, server-rendered, paginated
- [ ] Empty state and result count
**Acceptance:** filters are shareable as URLs and survive a reload.

## M1.8 — Paper index
- [ ] Author `content/papers/*.json` for at least 6 recent papers across bands 3–4 and 5–6
- [ ] `/papers` list with official PDF links (remote only)
- [ ] `/papers/[year]-[band]` per-question skill table
- [ ] "Skills most tested in this band" summary
**Acceptance:** a reviewer confirms zero official problem text or figures in the repo.

## M1.9 — Home, about, legal
- [ ] `/` per `docs/00-SPEC.md` §1.1, including the live sample problem
- [ ] `/about` in the first person — why this exists
- [ ] `/legal/privacy`, `/legal/terms`, `/legal/license` published
- [ ] `/contact` form (Resend) with mailto fallback
**Acceptance:** Lighthouse ≥95 on performance, accessibility, best practices, SEO.

## M1.10 — Launch content
- [ ] **150 original problems** authored, reviewed, and merged (bands 3–4 and 5–6)
- [ ] Figures for every problem that needs one
- [ ] Canonical example set for at least 40 skills
**Acceptance:** `pnpm validate:content` green; two reviewers signed off on all 150.

## M1.11 — Ship
- [ ] Custom domain (or lock the vercel.app URL) + HTTPS
- [ ] Self-hosted Umami analytics, cookie-free
- [ ] Give the URL to your current students; watch three of them use it in person
- [ ] Fix everything that confused them before touching Phase 2
**Acceptance:** a student who has never seen the site finds and solves a problem unaided.

---

# PHASE 2 — Accounts, adaptivity, and the mentor layer (Dec–Jan, ~7 weeks)
*Run the winter prep cycle entirely on the platform.*

## M2.1 — Supabase foundation
- [ ] Project created; local dev via Supabase CLI
- [ ] Migrations 001–009 from `docs/01-DATA-MODEL.md`
- [ ] RLS policies on every table, default deny
- [ ] `supabase/tests/rls.test.sql` proving isolation between two students
- [ ] `pnpm db:types` generating typed client
**Acceptance:** RLS tests pass; a student cannot read another student's attempts, proven in test.

## M2.2 — Auth and profiles
- [ ] Email magic-link sign-in (no passwords for kids to lose)
- [ ] Cohort join by code + first name — no email required for a student
- [ ] `/me/settings`: display name, band, theme, dyslexia font, reduced motion, locale
- [ ] **Export my data** (JSON) and **delete my account** (hard cascade delete)
- [ ] Parent-consent flow for under-13 cohort accounts, `parent_consents` table
**Acceptance:** a full account round-trip — create, use, export, delete — leaves no rows behind.

## M2.3 — Attempt recording
- [ ] `POST /api/attempt`, `POST /api/hint`, zod-validated and rate-limited
- [ ] Client records attempts optimistically; queues and retries offline
- [ ] Signed-out attempts stored in `localStorage` and offered for import on sign-up
**Acceptance:** attempts made offline appear after reconnect, exactly once.

## M2.4 — Mastery and scheduling
- [ ] `mastery.ts` implementing the state machine in `docs/01-DATA-MODEL.md` §3.1
- [ ] `ts-fsrs` integration scheduling **skills**, serving unseen problems
- [ ] `GET /api/mastery`, `GET /api/schedule`
- [ ] Mastery painted onto the Atlas and skill pages
**Acceptance:** unit tests cover every mastery transition including decay.

## M2.5 — `/dashboard` and `/me/progress`
- [ ] Mastery ring, streak, next drill, three weakest skills, assigned work
- [ ] Countdown to the third Thursday in March
- [ ] Full progress view with per-strand bars and attempt history
**Acceptance:** dashboard renders correctly for a brand-new account with zero data.

## M2.6 — `/practice/drill`
- [ ] Daily 10-minute session driven by the scheduler
- [ ] Streak tracking, session summary, "what you fixed today"
**Acceptance:** a missed skill on Monday reappears within the week with a different problem.

## M2.7 — `/practice/diagnostic`
- [ ] Adaptive item selection per `docs/01-DATA-MODEL.md` §3.4
- [ ] 15 items, ~25 minutes, works signed-out
- [ ] Result: Atlas heat overlay + generated 6-week plan + shareable summary card
**Acceptance:** two students with different weaknesses receive visibly different plans.

## M2.8 — `/practice/mock`
- [ ] Correct item counts and 3/4/5 thirds per band; 75-minute timer
- [ ] Flag for review; navigator grid; "no blanks" nudge at 5 minutes left
- [ ] Scoring out of 96 or 120, no penalty for wrong answers
- [ ] Post-exam report: per-tier accuracy, time-vs-accuracy scatter, skill heat, top-3 fixes
- [ ] Runs persisted; resumable if the browser closes
**Acceptance:** a full 75-minute run survives a refresh at minute 40 with the timer intact.

## M2.9 — `/practice/journal`
- [ ] Auto-collect misses; forced ≤280-char reflection
- [ ] Resurface after 7 days with a fresh problem in the same skill
**Acceptance:** entries resurface on schedule and can be marked resolved.

## M2.10 — Mentor layer
- [ ] Role gating (`mentor`) with server-side checks, not just UI hiding
- [ ] `/teach` overview with class-wide alerts
- [ ] `/teach/cohorts`, `/teach/cohort/[id]` — roster, join codes, consent status
- [ ] `/teach/heatmap` — Atlas colored by cohort mastery; click a node → who missed it and which distractor they chose
- [ ] `/teach/assign` — build and assign a set with a due date
- [ ] `/teach/sessions` — attendance, minutes, skills taught, notes
- [ ] Aggregate-only access path via a `security definer` function
**Acceptance:** a mentor can never retrieve another person's raw attempt rows, proven in test.

## M2.11 — `/print` worksheet generator
- [ ] Select by skill, band, points, count; shuffle; include or exclude figures
- [ ] Print stylesheet: no chrome, black figures, page breaks between problems
- [ ] Separate answer key with per-distractor tutor notes
- [ ] Cohort presets under `/teach/worksheet`
**Acceptance:** a generated PDF prints legibly on a home printer in black and white.

## M2.12 — PWA and offline
- [ ] Manifest, icons, install prompt
- [ ] Service worker caching the shell, the Atlas, and recently viewed problems
- [ ] Offline attempt queue (shared with M2.3)
- [ ] Tested on a low-end Android over a throttled connection
**Acceptance:** the site opens and serves cached problems with the network switched off.

## M2.13 — Authoring tools
- [ ] `/author/new` — form → valid problem JSON, live Zod validation, live preview
- [ ] "Copy JSON" and "open a PR" actions; no direct DB writes
- [ ] `/author/queue` — review checklist as a form, two approvals to merge
**Acceptance:** a problem authored entirely through the form passes CI unmodified.

## M2.14 — Content growth
- [ ] Reach **300 problems** total; extend into bands 1–2 and 7–8
- [ ] Every skill has at least three problems
**Acceptance:** no skill page shows an empty practice ladder.

---

# PHASE 3 — The proving season (Feb–Apr)
*The competition is the experiment. Collect honestly.*

## M3.1 — Baseline
- [ ] Every consenting cohort student completes a diagnostic before Feb 15
- [ ] Baselines stored with consent recorded
**Acceptance:** consent status is verifiable per student before any data is used.

## M3.2 — `/practice/triage`
- [ ] 12 problems, 3 minutes, now/later/guess only
- [ ] Scored against calibrated p-values and the student's own history
- [ ] Feedback naming their specific triage bias (over-committing vs. over-skipping)
**Acceptance:** a student who always picks "now" is told so explicitly.

## M3.3 — Calibration pipeline
- [ ] `scripts/calibrate.ts` computing p-value and median time at n≥30
- [ ] Nightly GitHub Action opening a PR with updated calibration
- [ ] Flag problems above 0.95 or below 0.15 for rewrite
**Acceptance:** difficulty shown on the site comes from data, never from a hand-set field.

## M3.4 — Competition run
- [ ] Final-stretch mock schedule for cohorts
- [ ] March: the exam
- [ ] April: post-diagnostics for the same consenting students
**Acceptance:** matched pre/post pairs with n recorded.

## M3.5 — `/impact`
- [ ] Live tiles from the database, cached
- [ ] Every tile links to a written definition
- [ ] Pre/post tile carries a permanent caveat and links to the methodology essay
- [ ] Aggregate suppression: never publish a figure derived from fewer than 10 students
**Acceptance:** no causal claim appears anywhere on the page. Have someone else check.

## M3.6 — `/methodology`
- [ ] Essay 1: how the taxonomy was built
- [ ] Essay 2: how difficulty is calibrated
- [ ] Essay 3: what version 1 got wrong
**Acceptance:** essay 3 names at least three real mistakes with what you changed.

## M3.7 — `/potd`
- [ ] Daily problem, 6pm solution reveal, archive by date
**Acceptance:** the reveal happens on schedule without a manual deploy.

---

# PHASE 4 — Hand it outward (Spring–Summer 2027)

## M4.1 — Tutor kit
- [ ] 8 lesson plans mapped to strands; slide decks; facilitator guide
- [ ] `/tutor-kit` with previews and a zip download
**Acceptance:** someone who has never met you runs a session from the kit alone.

## M4.2 — Spanish
- [ ] `/es` routing; translate skill definitions, problem statements, choices, solutions
- [ ] Locale switcher; `hreflang`; translated OG images
**Acceptance:** a Spanish-only user can complete a diagnostic end to end.

## M4.3 — Open data
- [ ] `GET /api/export` — full problem bank as JSON under CC BY-NC-SA
- [ ] Dataset README and citation line
**Acceptance:** a third party can rebuild a practice tool from the export alone.

## M4.4 — Variant generator
- [ ] Template DSL: parameter ranges, constraints, answer derivation, distractor derivation
- [ ] Generator with a solver that verifies every emitted variant
- [ ] Variants labeled as generated; excluded from mocks and the diagnostic
**Acceptance:** 100 generated variants, all verified correct, none degenerate.

## M4.5 — Contributors
- [ ] `CONTRIBUTING.md` pointing at the content guide
- [ ] Issue templates for "new problem" and "problem error"
- [ ] Onboard 3–5 peers; two-approval review enforced by CODEOWNERS
**Acceptance:** a merged problem authored by someone other than you.

## M4.6 — Partnerships
- [ ] Standing weekly session at the Los Altos Library using the platform
- [ ] One partner cohort outside Los Altos
- [ ] Handoff docs so the library session survives your graduation
**Acceptance:** a session runs that you did not personally lead.

---

# Cross-phase, never "done"

- [ ] 10 new problems every week
- [ ] Weekly: review the calibration flags and rewrite the worst problem
- [ ] Monthly: run `pnpm a11y` on every route and fix regressions
- [ ] Monthly: read three students' error journals and fix the explanations they didn't understand
- [ ] Quarterly: re-read the non-negotiables in `CLAUDE.md` and confirm nothing has drifted
