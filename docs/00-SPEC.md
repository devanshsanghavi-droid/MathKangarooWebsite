# 00 — Site Spec

Every surface of the website. If it is not here, it does not get built. Each route lists its
job, its content, its states, and its acceptance criteria.

Legend: **P1** ship in Phase 1 · **P2** Phase 2 · **P3** Phase 3 · **P4** Phase 4

---

## 0. Global

### 0.1 Design system — `src/styles/tokens.css` **P1**
The only file where colors exist. Defines light palette on `:root`, redefines tokens under
`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`.

Tokens: `--paper --surface --surface-2 --ink --ink-2 --ink-3 --rule --rule-2 --accent
--accent-2 --accent-soft --grid --p3 --p3-bg --p4 --p4-bg --p5 --p5-bg --focus`

Point-value colors (`--p3/--p4/--p5`) are semantic and map to the exam's 3/4/5-point tiers.
They are never used decoratively.

Type: display/UI sans, serif for problem text and prose, mono for IDs and metadata.
Scale: 12 / 13 / 15 / 17 / 20 / 25 / 32 / 44 px. Prose max-width 66ch.

### 0.2 App shell **P1**
- `<Header>` — wordmark, nav (Atlas · Problems · Practice · Papers · Impact), theme toggle,
  sign-in (P2). Mobile: bottom tab bar for Atlas / Practice / Search / Me.
- `<Footer>` — license line, GitHub link, privacy, **the non-affiliation disclaimer**, contact.
- `<CommandPalette>` (⌘K) — jump to any skill, problem id, or route. **P2**
- `<ThemeToggle>` — light / dark / system, persisted in `localStorage`.
- `<SkipLink>` to main content.

### 0.3 Cross-cutting **P1**
- `not-found.tsx`, `error.tsx`, `loading.tsx` at the app root.
- `robots.txt`, `sitemap.xml` generated from content.
- OG image generation via `next/og` — problem cards render the id, band, and point value.
- PWA: manifest, service worker, offline shell, "install" prompt. **P2**
- i18n routing `/` and `/es` with content-level translation fields. **P4**

---

## 1. Public surfaces

### 1.1 `/` — Home **P1**
**Job:** in ten seconds, make a student or parent understand this is different from a PDF dump.
- Hero: one sentence thesis + a live embedded sample problem with distractor feedback.
- "Start here" triad: Take the diagnostic · Browse the Atlas · Practice a skill.
- Strand strip: seven strands, problem counts, link into each.
- Problem of the Day card.
- Impact counters (problems authored / skills mapped / students served), pulled live.
- Footer disclaimer.
**Done when:** LCP < 1.5s on throttled 3G; the sample problem works without JS hydration errors.

### 1.2 `/atlas` — The Skill Atlas **P1**
**Job:** the map. The single most important page on the site.
- Interactive SVG graph, pan + zoom, nodes = skills, edges = prerequisites.
- Grouped by strand (7 columns or 7 clusters); toggle strand visibility.
- Node color = tier (foundation / core / 5-point gateway). Node fill = mastery, once signed in.
- Click a node → side panel with the skill summary and a link to its page.
- **Accessible fallback:** a fully navigable nested list view, toggled by a control and used
  automatically for screen readers. The graph is never the only way in.
- Filter by band (1–2 … 11–12), by point value, by "has problems".
- URL state: `/atlas?strand=CNT&band=5-6&focus=CNT-12`.
**Done when:** keyboard-only user can reach every skill; list view has parity with graph view.

### 1.3 `/atlas/[strand]` — Strand overview **P1**
Ordered walkthrough of one strand: foundation → core → gateway, with a one-line description
of each skill and its problem count.

### 1.4 `/skill/[id]` — Skill page **P1**
**Job:** teach one idea completely.
Sections, in order:
1. Name, id, strand, tier, bands where it appears.
2. **Definition** — plain language, 2–3 sentences.
3. **You'll recognize it when…** — 3–5 concrete trigger phrases.
4. **Canonical worked example** — one problem, fully solved, with figure.
5. **Common misconceptions** — bulleted, each phrased as the student's own reasoning.
6. **Prerequisites** and **unlocks** — linked skill chips.
7. **Practice ladder** — problems grouped 3 / 4 / 5 points, with mastery state.
8. **In official papers** — links into the paper index for problems testing this skill.
9. "Start a drill on this skill" CTA.
**Done when:** every skill file renders all nine sections or explicitly marks them absent.

### 1.5 `/problems` — Browse **P1**
Filterable, sortable table/grid. Filters: band, point value, strand, skill, status
(unseen / missed / mastered), source (original / paper index). Sort: id, difficulty
(calibrated p-value), newest. URL-encoded filter state. Paginated, server-rendered.

### 1.6 `/problem/[id]` — Single problem **P1**
- Metadata row: id, band, point-value pill, primary skill chip, calibrated difficulty.
- Statement + figure.
- Five choices as buttons. On select: distractor-specific feedback panel.
- Hint ladder: nudge → strategy → full solution, revealed one at a time; each reveal logged.
- "The elegant way" and "The reliable way" solutions where they differ.
- "Why this is on the test" — one line.
- Skill chips → skill pages. "Next problem in this skill" navigation.
- Report-a-problem link (opens a prefilled GitHub issue).
**Done when:** works with JavaScript disabled down to statement + solution disclosure.

### 1.7 `/papers` and `/papers/[year]-[band]` — Official paper index **P1**
**Job:** the legal, useful bridge to official material.
- Table of every published official paper with a link to the **official PDF on
  mathkangaroo.org** (never a local copy).
- Per paper: a numbered list of its 24 or 30 questions with our skill tags and point values —
  *our analysis, not their content*. No problem text, no figures, no answers.
- "Skills most tested in this band" summary chart.
**Done when:** a reviewer can confirm no official problem text or figure exists in the repo.

### 1.8 `/potd` — Problem of the Day **P2**
Today's problem, a countdown to the 6pm solution reveal, and an archive by date. Solutions
open into the standard problem view. Static generation with daily revalidation.

### 1.9 `/impact` — Impact dashboard **P3**
Live from the database. Tiles: problems authored, skills mapped, explanations written,
students who practiced, states/countries reached, hours of instruction logged, median
pre→post diagnostic delta with `n`.
**Every tile links to its definition.** The pre/post tile carries a permanent caveat line and
links to the methodology essay. No causal language anywhere on this page.

### 1.10 `/methodology` **P3**
Three MDX essays: *How the taxonomy was built* · *How difficulty is calibrated* ·
*What version 1 got wrong*. Long-form, with figures. These are the pages a serious reader
actually finishes.

### 1.11 `/tutor-kit` **P4**
Downloadable lesson plans, slide decks, facilitator guide, and printable problem sets, so a
librarian or teacher elsewhere can run a Kangaroo club. Zip download + per-file previews.

### 1.12 `/about`, `/contact` **P1**
Who built it and why, in the first person. Contact is a form → Resend, plus a mailto fallback.

### 1.13 `/legal/privacy`, `/legal/terms`, `/legal/license` **P1**
Privacy written in language a 5th grader's parent can read: what we store (little), what we
never store, how to delete it. License page explains CC BY-NC-SA on content, MIT on code.

### 1.14 `/print` — Worksheet generator **P2**
Pick skills, bands, point values, and count → generates a clean printable worksheet plus a
separate answer key with per-distractor tutor notes. `@media print` stylesheet, no header/nav,
figures render in pure black. Also reachable from any skill page.

---

## 2. Practice surfaces

### 2.1 `/practice/diagnostic` **P2**
15 adaptive problems, ~25 minutes. Branches on the **skill graph**, not raw difficulty: a miss
routes to that skill's prerequisites; a solve routes forward to what it unlocks.
Output: a mastery overlay on the Atlas + a generated 6-week plan + a shareable summary.
Works signed-out (results held in `localStorage`, offered for saving on sign-up).

### 2.2 `/practice/drill` **P2**
Spaced repetition over problem *types*. `ts-fsrs` schedules review of the **skill**, and each
review serves an unseen problem from that skill. 10-minute daily session. Streak counter.

### 2.3 `/practice/mock` **P2**
Full simulated exam: 24 questions/96 points (bands 1–2, 3–4) or 30/120 (bands 5–6 through
11–12), exact thirds at 3/4/5 points, 75-minute timer, flag-for-review, no penalty for wrong
answers, forced "no blanks" nudge at 5 minutes remaining.
Post-exam report: score, per-point-tier accuracy, **time-vs-accuracy scatter** showing where
points bled out, skill heat overlay, and a ranked list of the three skills to fix first.

### 2.4 `/practice/triage` **P3**
3 minutes, 12 problems, no solving. One call per problem: **now / later / guess**. Scored
against how those problems actually performed for this student and against the calibrated
p-values. Teaches the highest-leverage exam skill (CFT-08). Nothing else on the market has it.

### 2.5 `/practice/journal` **P2**
Auto-collected misses. Each entry forces one line: "what I'd do differently." Entries resurface
after 7 days for a re-attempt with a fresh problem in the same skill.

---

## 3. Student surfaces (auth required) **P2**

### 3.1 `/dashboard`
Mastery ring, current streak, next scheduled drill, the three weakest skills, assigned work
from a cohort, recent journal entries, days until the third Thursday in March.

### 3.2 `/me/progress`
Full Atlas with mastery painted in; per-strand progress bars; attempt history with filters.

### 3.3 `/me/settings`
Display name (first name only), band, theme, dyslexia-friendly type toggle, reduced motion,
language, **export my data** (JSON), **delete my account** (hard delete, confirmed).

---

## 4. Mentor surfaces (role: `mentor`) **P2**

### 4.1 `/teach` — Overview
Cohorts, upcoming sessions, assignments needing review, class-wide alerts
("18 of 24 red on GEO-10").

### 4.2 `/teach/cohorts` and `/teach/cohort/[id]`
Roster with join codes (no student email required — a code plus a first name is enough).
Per-student mastery sparkline. Add/remove members. Parent-consent status per member.

### 4.3 `/teach/heatmap`
The Atlas colored by **cohort** mastery instead of individual. Click a red node → the list of
students who missed it and the specific distractors they chose. This is the lesson plan.

### 4.4 `/teach/assign`
Build a set (by skill, band, point value, or hand-picked ids), assign to a cohort, set a due
date. Students see it on their dashboard.

### 4.5 `/teach/sessions`
Session log: date, attendance, skills taught, notes, what to revisit. Feeds the hours-of-
instruction figure on `/impact`.

### 4.6 `/teach/worksheet`
The `/print` generator with cohort presets and a tutor answer key including distractor notes.

### 4.7 `/teach/parents` **P3**
Auto-drafted weekly parent note per student (three sentences: what they worked on, what
improved, what's next). **Human approves before anything sends.** Resend delivery, opt-out link.

---

## 5. Authoring surfaces (role: `author`) **P2**

### 5.1 `/author/new`
A form that produces a valid problem JSON file: statement, 5 choices each with a required
misconception field, 3 hints, skill tags, band, points, figure id, alt text. Live Zod
validation, live preview, "copy JSON" and "open PR" actions. No direct DB writes — content
still lands in git through a pull request.

### 5.2 `/author/queue`
Problems awaiting second review, with the review checklist from `docs/03-CONTENT-GUIDE.md`
rendered as a form. Two approvals required to merge.

---

## 6. API routes **P2**

| Route | Method | Purpose |
|---|---|---|
| `/api/attempt` | POST | Record an attempt (problem id, chosen key, ms elapsed, hints used) |
| `/api/hint` | POST | Log a hint reveal at level 1/2/3 |
| `/api/mastery` | GET | Current mastery vector for the signed-in user |
| `/api/schedule` | GET | Next FSRS-due skills |
| `/api/diagnostic` | POST | Next adaptive item / finalize and produce the plan |
| `/api/mock` | POST | Start, submit, and score a mock run |
| `/api/cohort/[id]/heatmap` | GET | Aggregate cohort mastery (mentor only) |
| `/api/impact` | GET | Cached public counters for `/impact` and `/` |
| `/api/og/[id]` | GET | Open Graph card for a problem or skill |

All write routes: zod-validated body, rate-limited, RLS-enforced, no PII in logs.

---

## 7. Component inventory

`ProblemCard` · `ChoiceList` · `FeedbackPanel` · `HintLadder` · `SolutionTabs` ·
`FigureRenderer` · `SkillChip` · `PointPill` · `BandPill` · `AtlasGraph` · `AtlasList` ·
`AtlasNode` · `MasteryRing` · `StrandStrip` · `FilterBar` · `Timer` · `FlagButton` ·
`ScoreReport` · `TimeAccuracyChart` · `HeatmapLegend` · `CohortTable` · `AssignmentBuilder` ·
`WorksheetPreview` · `StatTile` · `Callout` · `Prose` · `ThemeToggle` · `CommandPalette` ·
`ConsentBanner` · `EmptyState` · `ErrorState`

Each ships with: a light and dark rendering, a keyboard path, and a Vitest render test.
