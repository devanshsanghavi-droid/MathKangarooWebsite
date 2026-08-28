# 04 — Claude Code Session Prompts

Copy-paste prompts, one per milestone. They assume Claude Code is running in the repo root
with `CLAUDE.md` present.

## How to run these well

- **One milestone per session.** Clear context between milestones (`/clear`). Long sessions
  drift and start re-litigating decisions already in the docs.
- **Start every session with the read.** The prompts below do this explicitly; keep it.
- **Plan before code on anything non-trivial.** Ask for a plan, read it, correct it, then say go.
- **Make it prove itself.** End every milestone with the definition-of-done command block.
- **Commit per milestone**, not per file. One reviewable PR per milestone.
- **When it wants to add a dependency**, make it justify it. The dependency budget is the
  main thing that keeps a solo project maintainable.

---

## Phase 0

### M0.1 — Taxonomy files
```
Read CLAUDE.md and docs/03-CONTENT-GUIDE.md.

Create content/skills/<STRAND>/<ID>.json for all 91 skills in Part A of the content guide,
matching the Skill schema in docs/01-DATA-MODEL.md §1.1.

For each skill, write: definition (2-3 plain sentences, no jargon a 5th grader wouldn't know),
recognizeWhen (3-5 concrete trigger phrases a student would actually see in a problem), and
misconceptions (at least 2, each phrased in the student's own voice, e.g. "I counted the
squares I could see and stopped").

Leave canonicalProblem null for now. Fill prerequisites using the tier structure and
mathematical dependency - be conservative, only real prerequisites. Leave unlocks as [].

Then write scripts/derive-unlocks.ts that regenerates every unlocks array from prerequisites
and fails if the graph has a cycle. Run it.

Show me NUM-01, CNT-12, GEO-10, and CFT-08 first and wait for my approval on the tone before
writing the other 87.
```

### M0.2 — Repo and rails
```
Read CLAUDE.md and docs/00-SPEC.md §0.

Scaffold the Next.js 15 App Router project per CLAUDE.md's stack table: TypeScript strict,
Tailwind v4, ESLint, Prettier, Vitest. Then:

1. src/styles/tokens.css with the complete light/dark token set from docs/00-SPEC.md §0.1.
   Follow the three-state theming rule: :root defines light, @media (prefers-color-scheme:dark)
   guarded as :root:not([data-theme="light"]) redefines tokens, :root[data-theme="dark"]
   redefines them again. Never a hex literal outside this file.
2. src/lib/schemas.ts - Zod schemas for Skill, Problem, PaperIndex from docs/01-DATA-MODEL.md §1.
3. scripts/validate-content.ts and a pnpm validate:content script implementing every rule in
   §1.1-1.3 including the acyclic check and cross-reference checks.
4. .github/workflows/ci.yml: install, typecheck, lint, test, validate:content, build.
5. LICENSE (MIT) and CONTENT-LICENSE (CC BY-NC-SA 4.0), README.md.

Plan first. Do not add any dependency not in CLAUDE.md's table without telling me why.
```

### M0.3 — CI guardrails
```
Read CLAUDE.md's non-negotiables and docs/02-BUILD-PLAN.md M0.3.

Add the five content guardrails to scripts/validate-content.ts. For each rule, create a
fixture under scripts/__fixtures__/ that must fail and one that must pass, and a Vitest test
asserting both. The 2KB cap on content/papers/ files is a deliberate tripwire against anyone
pasting official problem text - comment it as such.
```

---

## Phase 1

### M1.1 — App shell
```
Read CLAUDE.md and docs/00-SPEC.md §0.2 and §1.

Build the app shell: root layout, Header with nav and ThemeToggle (light/dark/system,
persisted to localStorage, no flash of wrong theme), Footer with the non-affiliation
disclaimer, mobile bottom tab bar, SkipLink, global focus-visible and prefers-reduced-motion
rules, and not-found/error/loading pages.

Every color from tokens.css. Verify in both themes at 360px and at 200% zoom before you
tell me it's done, and run pnpm a11y.
```

### M1.2 — Content layer
```
Read docs/01-DATA-MODEL.md.

Build src/lib/content.ts: typed build-time loaders for skills, problems, and paper indexes,
plus derived indexes (problems by skill, skills by strand, skills by band, the prerequisite
graph as adjacency lists). Pure functions, cached at module scope, no async, no any.
Unit test every loader and index against fixtures.
```

### M1.3 — Problem components
```
Read docs/00-SPEC.md §1.6 and §7, and docs/03-CONTENT-GUIDE.md Part B.

Build PointPill, BandPill, SkillChip, FigureRenderer, ChoiceList, FeedbackPanel, HintLadder,
SolutionTabs, ProblemCard.

The critical behavior: when a student selects a choice, FeedbackPanel shows the misconception
recorded for THAT choice - not a generic solution. Correct selection shows the reliable
solution plus the transferable principle.

ChoiceList must be fully keyboard operable with aria-pressed. HintLadder reveals one level at
a time and emits an event per reveal (we log these later). With JavaScript disabled, the
statement, choices, and a <details> solution must still render.

Render tests for each component in light and dark.
```

### M1.4 / M1.5 — Problem and skill pages
```
Read docs/00-SPEC.md §1.4 and §1.6.

Build /problem/[id] and /skill/[id] exactly to spec - all nine skill-page sections in order.
Static params for every content file. generateMetadata with real titles and descriptions,
and an OG image per problem via next/og showing the id, band, and point value.

Add next/previous navigation within a skill, and a report-a-problem link that opens a
prefilled GitHub issue.
```

### M1.6 — The Atlas
```
Read docs/00-SPEC.md §1.2 and §1.3.

Build the Skill Atlas. Two views with identical content:

1. AtlasGraph - deterministic SVG layout (layer by tier, cluster by strand), pan and zoom,
   click to focus, filters for strand/band/has-problems, URL state as
   /atlas?strand=CNT&band=5-6&focus=CNT-12.
2. AtlasList - a nested list with full parity, keyboard-first, and the view screen readers
   get automatically.

The graph must never be the only way to reach a skill. Write the layout as a pure function
so it is testable and stable across builds. Add /atlas/[strand] walkthrough pages.

Plan the layout algorithm before implementing it.
```

### M1.8 — Paper index
```
Read docs/00-SPEC.md §1.7, docs/01-DATA-MODEL.md §1.3, and the first non-negotiable in CLAUDE.md.

Build /papers and /papers/[year]-[band]. These pages present OUR skill analysis of official
past papers and link out to the official PDFs on mathkangaroo.org. They must contain no
official problem text, no figures, and no answers - only question number, point value, our
skill tags, and an optional short characterization in our own words.

Also add the "skills most tested in this band" summary. Confirm the 2KB tripwire from M0.3
still passes.
```

### M1.9 — Home
```
Read docs/00-SPEC.md §1.1.

Build the home page. The hero must include a working sample problem with distractor-specific
feedback - that interaction is the product, so it goes above the fold. Then the start-here
triad, the seven-strand strip with live problem counts, Problem of the Day placeholder, and
impact counters read from content at build time.

Target Lighthouse >= 95 on all four categories. Tell me the numbers.
```

---

## Phase 2

### M2.1 — Database
```
Read docs/01-DATA-MODEL.md §2 and CLAUDE.md's non-negotiables.

Write supabase/migrations/001-009 exactly as specified. Then write RLS policies for every
table with default deny, and supabase/tests/rls.test.sql proving that student A cannot read
student B's attempts, mastery, runs, or journal entries, and that a mentor gets aggregates
only through the security definer function - never raw rows.

The users are minors. Treat any policy gap as a build failure.
```

### M2.4 — Mastery and scheduling
```
Read docs/01-DATA-MODEL.md §3.1 and §3.2.

Implement src/lib/mastery.ts as an explicit state machine (unseen/seen/shaky/mastered) with
the transitions and the 14-day decay rule, and src/lib/schedule.ts wrapping ts-fsrs so that
FSRS schedules SKILLS while the server serves an unseen PROBLEM from that skill.

Unit test every transition including decay and the "no hint above level 1" condition on
mastery.
```

### M2.8 — Mock exam
```
Read docs/00-SPEC.md §2.3 and docs/01-DATA-MODEL.md §3.5.

Build /practice/mock. Correct counts per band (24/96 for bands 1-2 and 3-4, 30/120 for the
rest), exact 10/10/10 or 8/8/8 split across 3/4/5 points, 75-minute timer, flag for review, a
navigator grid, and a "no blanks" nudge at 5 minutes remaining because wrong answers cost
nothing.

The run must be resumable: persist state so a refresh at minute 40 restores the timer and
answers. Post-exam report: score, per-tier accuracy, a time-vs-accuracy scatter showing where
points were lost, skill heat overlay, and the top three skills to fix.
```

### M2.10 — Mentor layer
```
Read docs/00-SPEC.md §4 and docs/01-DATA-MODEL.md §2.1.

Build the mentor surfaces. Role checks server-side, never UI-only. The heatmap is the
centerpiece: the Atlas colored by cohort mastery, and clicking a red node shows which students
missed it and WHICH DISTRACTOR each chose - that is the lesson plan.

Access to other people's data is aggregate-only through the security definer function. Add a
test that a mentor calling the raw tables directly gets zero rows.
```

---

## Phase 3+

### M3.3 — Calibration
```
Read docs/01-DATA-MODEL.md §3.3.

Write scripts/calibrate.ts computing p-value and median solve time for every problem with at
least 30 first-attempts, writing results back into the problem JSON files. Add a nightly
GitHub Action that runs it and opens a PR with the diff. Flag problems above 0.95 or below
0.15 in the PR body as rewrite candidates.
```

### M3.5 — Impact dashboard
```
Read docs/00-SPEC.md §1.9 and docs/01-DATA-MODEL.md §4.

Build /impact from live data. Every tile links to a written definition of what it counts.
The pre/post tile must carry a permanent caveat: no control group, self-selected sample, and
the honest claim is association not causation. Suppress any figure derived from fewer than
10 students.

Then re-read the page and flag any sentence that implies causation. There should be none.
```

### M4.4 — Variant generator
```
Read docs/03-CONTENT-GUIDE.md Part D.

Design a template DSL for parameterized problems: parameter ranges, constraints, derived
correct answer, and derived distractors tied to named misconceptions. Then write a generator
that emits variants and a solver that independently verifies each one before it is accepted.

Generated variants must be labeled as generated and excluded from mocks and the diagnostic.
Prove it with 100 generated variants and a test that every one is verified and non-degenerate.
```

---

## The closing block for every session

```
Now run the definition of done from CLAUDE.md:

pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content

Then confirm, explicitly, one at a time:
- renders correctly in light AND dark
- fully keyboard operable with a visible focus state
- readable at 360px wide and at 200% zoom
- no console errors or warnings
- RLS policy written and tested, if this touched student data

Then commit with a message in the form "area: what changed" and open a PR whose body lists
any assumptions you made where the spec was ambiguous.
```
