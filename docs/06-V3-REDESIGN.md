# 06 - v3: the practice-app redesign and the AMC beta

**Supersedes** the page layouts in `docs/00-SPEC.md` and the shape/layout parts of
`docs/05-DESIGN-DIRECTION.md`. It does **not** supersede the palette rule in docs/05 §2: green,
red and amber remain reserved for answer feedback, and `pnpm check:palette` still gates the
build. Every other non-negotiable in `CLAUDE.md` stands (original problems only, a
misconception on every wrong choice, alt text on every figure, no account required, no
trackers, no leaderboards, no points or badges, WCAG 2.1 AA).

Decided by the owner on 2026-11-14:

1. The whole UI moves to a practice-app layout modelled on OnePrep's SAT question bank
   (layout and interaction only, never their colours, copy or assets).
2. An **AMC 10 / AMC 12 beta** area is added. This overrides the old "AMC content is out of
   scope" line for this area only. Every AMC problem is original work; official AMC problems
   are never reproduced, reworded or summarised, exactly like the Math Kangaroo rule.
3. The Math Kangaroo bank grows to **1,000 problems**; AMC problems are counted separately on
   top (target about 300).

---

## 1. Visual language

The reference is OnePrep: a calm, white, app-like practice tool.

- **Surfaces**: page `--ground`, content on `--surface` cards with `--shadow-1`, radius 12px
  for cards and panels, 8px for controls, full pill (999px) for chips. Add radius tokens to
  `tokens.css` (`--radius-card`, `--radius-control`, `--radius-pill`) and use them via
  Tailwind arbitrary values or theme config. Never a hex literal outside `tokens.css`.
- **Type**: Figtree for UI. Big confident numbers (counts, progress) in Figtree semibold
  with `tabular-nums`. Problem statements stay in the reading face at `--step-2`.
- **Accent**: the single teal (`--accent-*`) for the primary action, selected chips, active
  navigation and progress fills. Difficulty uses the neutral `--d1..--d3` ramp with its
  dot glyphs. Mastery/progress uses the `--m0..--m3` teal ramp.
- **Progress bars** are the main "gamified" element: solved / total per skill, strand, level,
  AMC area and topic. Thin (6px) rounded bars, teal fill, label with the numbers. Also
  allowed: the existing streak, "N solved this week", completion rings per area. Not allowed:
  points, XP, badges, leaderboards, comparisons with other students.
- **Density**: tables and lists are compact (OnePrep's question list), panels are airy.

## 2. App shell

- Top bar (sticky, `--surface`, hairline bottom border): wordmark, primary nav
  **Practice** (`/`), **Question bank** (`/problems`), **Skill Atlas** (`/atlas`),
  **Past papers** (`/papers`), **AMC** with a "Beta" pill (`/amc`), then theme toggle.
  Mobile: the existing bottom tab bar, updated to the same destinations.
- Content width: 1200px max for app pages, reading pages keep their prose measure.
- Footer keeps the Math Kangaroo disclaimer on every page. Pages under `/amc` additionally
  carry: *"AMC 10 and AMC 12 are trademarks of the Mathematical Association of America.
  Independent project. Not affiliated with or endorsed by the MAA."*

## 3. Every route is static

The Workers free plan allows 100,000 worker requests a day and 10 ms of CPU per request.
Static assets (files in `public/`) are free and unlimited. So:

- **No page reads `searchParams` on the server.** Every page route is statically generated
  (`dynamic = 'force-static'` where needed, `generateStaticParams` + `dynamicParams = false`
  on every `[param]` route). The `next build` route table must show no `ƒ` page routes
  (API routes and the admin/login server actions are the only exceptions).
- **Filtering happens in the browser.** Filter controls are buttons, checkboxes and selects,
  never `<a href="?...">` links, so crawlers find no filter URLs. The current selection is
  mirrored into the URL with `history.replaceState` so it is shareable, and read back on the
  client (wrap `useSearchParams` consumers in `<Suspense>`).
- **Bank data is a static file.** `scripts/build-static-data.ts` runs in `prebuild` and writes
  (gitignored) `public/data/`:
  - `public/data/ka-index.json` - one light row per Kangaroo problem: id, band, points,
    statement (plain, truncated to 220 chars), hasFigure, primary skill id, secondary skill
    ids, strand.
  - `public/data/amc-index.json` - the same for AMC: id, contest, slot, tier, area, topic,
    types, statement.
  - `public/data/p/<ID>.json` - the full problem for practice sessions (both banks).
  - Lookup tables the client needs (skill names by id, strands, AMC taxonomy).
- The server-side content bundle (`src/lib/content.bundle.json`) must not be needed by any
  request-time code path once this is done. Pages read content at build time.

## 4. Kangaroo surfaces

### `/problems` - the question bank (OnePrep layout)
- **Left filter panel** (desktop: sticky 300px column; mobile: a "Filters" sheet):
  level segmented control (1-2 ... 11-12, plus All), then one accordion per strand with
  a checkbox per skill showing `solved / total`, a difficulty group (3 / 4 / 5 points with
  dot glyphs), status (To do / Attempted / Solved), "Has a figure".
- **Main column**: a header card with the count selected, a progress bar for the
  selection, **Start practice (N)** (primary) and **Random unsolved**. Below it the compact
  question list: status glyph, id, statement preview, difficulty pill, level, skill.
  Client-side pagination (50 per page) or windowing.
- Selection and status come from `public/data/ka-index.json` + localStorage progress.

### `/practice/set` - the practice session (the core engine)
- Reads `?ids=KA-0001,KA-0002,...` (or `?bank=amc&ids=...`) on the client and fetches
  `public/data/p/<id>.json` for each.
- Test-like layout: top bar with the set name, "Question 3 of 20", an optional count-up
  timer that can be hidden, and **Mark for review**. Bottom bar: Back, a question navigator
  (numbered squares showing answered / marked / current, opened as a grid popover), Next.
- Answering: pick a choice, **Check**. Feedback uses the existing reserved colours and shows
  the misconception for the exact wrong choice, the graduated hints, and the solutions.
  Records attempts through `saveAttempt` exactly as the problem page does today.
- End screen: score for the set, time, per-skill breakdown with progress bars, "Review
  missed" (a new set of the missed ids) and "Back to the bank".
- One component, `PracticeSession`, used by `/practice/set`, `/problem/[id]` (a set of one),
  the AMC bank, and restyled diagnostic and mock tests where practical.

### Other Kangaroo pages
- `/` becomes the **Practice home**: for a returning student a "Continue" card, solved counts
  per level, per-strand progress bars, problem of the day, quick starts (Diagnostic, Mock
  test, Random unsolved, Start a skill). For a new visitor a short hero, level picker and the
  same quick starts. No sign-in prompt beyond the existing optional one.
- `/atlas`, `/skill/[id]`, `/papers`, `/print`, `/practice/diagnostic`, `/practice/mock`,
  `/about`, legal pages: restyled into the shell; filters client-side; all static.

## 5. The AMC beta (`/amc`)

### Content (all under `content/amc/`)
- `content/amc/taxonomy.json` - areas, topics and problem types:
  - **Areas**: `ALG` Algebra, `GEO` Geometry, `NT` Number theory, `CP` Counting and
    probability.
  - **Topics** (ids like `ALG-03`), each with a name, area and a 1-2 sentence description.
    Roughly 8-12 per area.
  - **Problem types** (ids like `T-TELESCOPE`): the recurring competition patterns, e.g.
    complementary counting, casework, stars and bars, telescoping sums, Vieta's formulas,
    clever factoring (SFFT), invariants, pigeonhole, modular arithmetic, power of a point,
    similar triangles, coordinate bash, mass points, angle chasing, expected value by
    linearity, recursion, symmetry, working backwards, extreme principle, bounding. Each has
    a name, description, "recognize when" cues (3-5) and the areas it appears in.
- `content/amc/problems/<10|12>/AM-0001.json` - schema `AmcProblemSchema`:
  `id` (`AM-\d{4}`), `contest` (`AMC10` | `AMC12` | `BOTH`), `slot` (1-25: where it would sit
  on a real paper), `area`, `topic`, `types` (1-3 problem-type ids), `statement` (KaTeX with
  `$...$`), `figure` (nullable, same rules as Kangaroo; keep figures rare), 5 `choices` A-E
  with `misconception` on every wrong one (same rule and same voice as Kangaroo), `hints`
  [nudge, strategy, full], `solutions` {reliable, elegant|null}, `formulas` (formula ids
  used), `estSeconds`, `author`, `reviewedBy`, `createdAt`, `license`.
  Difficulty tier derives from slot: 1-10 Early, 11-20 Middle, 21-25 Late. For progress
  records it maps to points 3 / 4 / 5.
- `content/amc/formulas/<AREA>/F-ALG-01.json` - schema `FormulaSchema`: `id`, `area`,
  `name`, `formula` (KaTeX), `whenToUse` (one or two sentences), `example` (a short worked
  example, original), `pitfall` (the common mistake), `priority` (`must-know` |
  `good-to-know`), `contests` (`AMC10`, `AMC12`), optional `derivation`. Target about 80.

### Routes
- `/amc` - landing: AMC 10 / AMC 12 switch, per-area cards with counts and progress bars,
  "Must-know formulas" and "Problem types" entry cards, "Start a mixed set".
- `/amc/problems` - the same bank component with AMC filters: contest, area -> topic
  checkboxes with counts, problem type chips, tier (Early / Middle / Late), status.
- `/amc/problem/[id]` - a practice session of one.
- `/amc/types` and `/amc/type/[id]` - every problem type with its description, cues, the
  formulas it leans on and its problems.
- `/amc/formulas` - the formula sheet by area, must-know first, contest filter, printable.
- `/amc/formulas/drill` - flashcards: front = name + "when to use", back = formula + example.
  Self-graded Again / Hard / Good / Easy, scheduled with `ts-fsrs`, stored in localStorage
  (key `ka-amc-formulas`). Self-grade buttons are neutral (they are not the site judging an
  answer). "Due today" count and a "Must-know only" toggle.
- Progress for AMC problems uses the same localStorage attempt store, keyed by the AM id.

## 6. Authoring rules for the new problems (both banks)

- `docs/03-CONTENT-GUIDE.md` governs Kangaroo authoring. The same quality bar applies to AMC.
- **Original only.** Never adapt a problem you remember from a real Math Kangaroo, AMC,
  MATHCOUNTS or AoPS source. Change the mathematics, not just the numbers.
- **Every wrong choice carries a misconception** in the student's voice, starting with "I",
  that actually produces that exact number. Compute each distractor from its misconception.
- **The answer must be checked.** Solve every problem twice by different methods; for
  counting and number theory, brute-force check with a short script when possible.
- Hints are graduated: nudge, strategy, nearly the full step.
- `whyOnTest` (Kangaroo) names the skill being tested in plain words.
- Follow the existing convention: `author: "Devansh Sanghavi"`, `reviewedBy: ["pending-review"]`
  (a human review of the AI-drafted batches is still owed), `createdAt: "2026-11-14"`,
  `license: "CC-BY-NC-SA-4.0"`, `calibration: { pValue: null, medianMs: null, n: 0 }`.
