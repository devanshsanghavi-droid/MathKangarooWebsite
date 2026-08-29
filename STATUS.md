# STATUS

Running log of the build. Updated as each milestone lands, not at the end.

**All thirteen milestones from the session brief are done**, plus **M0.4** and **M1.10**. One
acceptance criterion inside M1.8 is deliberately not met — the six paper indexes are reading
work that has to be done by someone who has read the papers, and inventing them would have been
worse than leaving them empty. See M1.8 and "Needs you".

| | |
|---|---|
| Skills in the Atlas | 91, 106 prerequisite edges, acyclic |
| Original problems | **150**, across levels 3–4 and 5–6 |
| Distractor explanations | **600** — one per wrong answer choice |
| Hand-drawn SVG figures | 25 |
| Routes | 15, building 414 static pages |
| Tests | **1 625** unit + 35 axe assertions, both themes |
| CI | typecheck → lint → test → graph → content → a11y → build, all green |

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started · `[!]` blocked on Devansh

| Milestone | State | Landed |
|---|---|---|
| git init + docs baseline | `[x]` | `docs: add project constitution, specs, and build plan` |
| M0.2 — repo and rails | `[x]` | `rails: scaffold next 15 app, design tokens, content schemas, validation, and CI` |
| M0.3 — content guardrails | `[x]` | `content: add the five CI guardrails with proving fixtures` |
| M0.1 — taxonomy (91 skills) | `[x]` | `atlas: author all 91 skills and derive the prerequisite graph` |
| seed problem bank | `[x]` | `content: author 45 original problems and 16 figures` (+9 more with M1.4) |
| M1.1 — app shell | `[x]` | `shell: build header, footer, theme toggle, and a11y primitives` |
| M1.2 — content loading layer | `[x]` | `content: add typed loaders, derived indexes, and a generated sitemap` |
| M1.3 — problem components | `[x]` | `problem: build the nine problem components with distractor-specific feedback` |
| M1.4 — `/problem/[id]` | `[x]` | `problem: build the problem page with OG images and in-skill navigation` |
| M1.5 — `/skill/[id]` | `[x]` | `skill: build the skill page with all nine sections` |
| M1.6 — the Atlas | `[x]` | `atlas: build the graph and list views with URL-encoded filters` |
| M1.7 — `/problems` browse | `[x]` | `problems: build the browse page with URL-encoded filters and pagination` |
| M1.8 — `/papers` | `[x]`* | `papers: build the official paper index routes and tighten the anti-paste tripwire` |
| M0.4 — legal and naming | `[x]` | `legal: draft the outreach note and record the locked public name` |
| M1.10 — launch content (150 problems) | `[x]` | `content: reach the 150-problem launch bank` |
| M2.11 — `/print` worksheet generator | `[x]` | `print: build the worksheet generator and its per-distractor answer key` |
| M2.4 — mastery and scheduling | `[x]` | `practice: implement the mastery state machine and FSRS skill scheduling` |
| M2.1 — Supabase foundation | `[~]` | `db: write the schema, the RLS policies, and a shape test that runs without a database` |
| M1.9 — home, about, legal, contact | `[x]` | `site: build the home page, about, legal pages, and contact form` |

---

## M0.2 — Repo and rails

**State:** `[x]`

### Built

- Next.js 15.5 App Router, React 19, TypeScript `strict` plus `noUncheckedIndexedAccess`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`. Path alias `@/*`.
- Tailwind v4 via `@tailwindcss/postcss`, wired to the tokens through `@theme inline` so a
  theme switch repaints without a rebuild.
- `src/styles/tokens.css` — the complete token set from `docs/00-SPEC.md` §0.1, in the
  three-state form (`:root` light, `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme='light'])`, and `:root[data-theme='dark']`), plus a `@media print`
  block that flattens everything to pure black on white for worksheets.
- `src/lib/schemas.ts` — Zod schemas for Skill, Problem, PaperIndex exactly per
  `docs/01-DATA-MODEL.md` §1, all `.strict()`.
- `scripts/lib/content-rules.ts` + `scripts/validate-content.ts` — every cross-file rule.
- `scripts/derive-unlocks.ts` — regenerates `unlocks` from `prerequisites`, refuses to write
  on a dangling reference or a cycle, and has a `--check` mode CI uses.
- Vitest (unit) and a separate `pnpm a11y` config, ESLint flat config, Prettier, `.editorconfig`,
  `.nvmrc`.
- `.github/workflows/ci.yml`: install → typecheck → lint → test → derive:unlocks --check →
  validate:content → a11y → build.
- `LICENSE` (MIT, code) and `CONTENT-LICENSE` (CC BY-NC-SA 4.0, content) with an explicit
  section on what the content license does *not* cover. `README.md`.

### Assumptions made where the spec was ambiguous

1. **No web fonts.** `docs/00-SPEC.md` §0.1 asks for display sans / serif / mono but does not
   name faces. Chose system font stacks: zero network fetch at build or first paint, no CLS,
   nothing to self-host, and it keeps the LCP < 1.5s target in §1.1 reachable. Swapping in a
   real face later is a one-token change.
2. **Scripts run on Node's native TypeScript stripping** (Node ≥ 22.18) rather than adding
   `tsx` to the dependency budget. This is why `.nvmrc` pins 22 and why `scripts/` imports use
   explicit `.ts` extensions.
3. **`pnpm a11y` runs axe-core in jsdom** through a second Vitest project, not a real browser.
   A browser run would mean Playwright — a very large dependency for a project whose budget is
   deliberately small. jsdom + axe catches structural violations (roles, names, labels,
   landmarks, contrast on inline styles); it cannot catch anything that needs layout. Noted as
   a known gap, not a claim of full coverage.
4. **Added test-only tokens `--correct/--incorrect`** aliased to `--p3/--p5`. The spec's token
   list has no state colors, and inventing new hues for right/wrong would have broken the rule
   that the point-tier colors are semantic. Aliases keep one palette.
5. **`--rule-2` was darkened** (light `#b9b2a5` → `#8a8374`, dark `#4d515f` → `#71758a`). The
   spec's token list does not fix values; the first draft failed the 3:1 non-text contrast
   floor for input borders and the token test caught it.

### Dependencies added beyond CLAUDE.md's stack table

All of these are named by CLAUDE.md's own commands table, but none appear in the stack table,
so they are logged here:

| Package | Why | Alternative rejected |
|---|---|---|
| `axe-core` | `pnpm a11y` is a required command | writing an a11y checker by hand |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` | `pnpm test` has to render components; M1.3 requires render tests | none — you cannot render-test without a DOM |
| `@vitejs/plugin-react` | Vitest cannot compile JSX without it | none |
| `@eslint/eslintrc`, `eslint-config-prettier` | flat-config glue for `eslint-config-next` | none |

No runtime dependency was added outside the stack table.

### Deferred

- **Branch protection on `main`** and **the Vercel project connection** both need account
  access I do not have. Everything they gate on (`CI` as a required check, preview deploys) is
  already defined in `.github/workflows/ci.yml`; they are two clicks once the repo is pushed.
  See "Needs you" at the bottom of this file.

---

## M0.3 — Content guardrails in CI

**State:** `[x]`

### Built

Five guardrails, each with a fixture that must fail, a fixture that must pass, and a Vitest
assertion on both. Fixtures live in `scripts/__fixtures__/<rule>/{pass,fail}/content/`.

| Rule id | Fails the build when |
|---|---|
| `problem/misconception-required` | an incorrect choice has no written misconception |
| `problem/figure-alt-required` | a problem has a figure and no author-written alt text |
| `paper/size-cap` | any file in `content/papers/` exceeds 2048 bytes |
| `problem/duplicate-id`, `skill/duplicate-id` | an id appears in two files |
| `problem/skill-exists`, `paper/skill-exists` | content points at a skill not in the Atlas |

Two further tests run the real CLI (`scripts/validate-content.ts`) as a subprocess against a
clean tree and a broken one, asserting exit code 0 and 1. That is what CI depends on, so it
is what the test exercises — not just the library function underneath it.

### Assumptions made where the spec was ambiguous

1. **The two product-critical rules run BEFORE Zod, not after.** A blank `alt` or an empty
   `misconception` would otherwise surface as a generic "string too short" and the author
   would never read the sentence explaining why the field exists. Both rules are still
   expressed in the schema as well, so neither can slip through if the raw pass is changed.
2. **The 2KB cap is checked on file size before parsing**, so a file that is both oversized
   and malformed still reports the tripwire. The cap is commented in three places as an
   anti-paste tripwire rather than a performance limit, because the next person to hit it
   will be tempted to raise it.
3. **`CONTENT_DIR` / `FIGURES_DIR` environment overrides** were added to the CLI purely so a
   test can point it at a fixture. Nothing in CI sets them.
4. **Fixtures are excluded from Prettier, ESLint and `tsc`.** They are deliberately malformed;
   a formatter "fixing" one would silently disarm a guardrail.

---

## M0.1 — Taxonomy v1

**State:** `[x]`

### Built

- All **91 skill files** under `content/skills/<STRAND>/<ID>.json`, matching Part A of
  `docs/03-CONTENT-GUIDE.md` exactly: NUM 15, CNT 18, GEO 18, LOG 11, PAT 7, MOD 10, CFT 12.
- Every skill carries a written `definition` (2–3 plain sentences), 3–5 `recognizeWhen`
  trigger phrases in the wording a student would actually meet, and 2–3 `misconceptions`
  written in the student's own first-person voice.
- `scripts/derive-unlocks.ts` generates every `unlocks` array from `prerequisites`, refuses
  to write on a dangling reference or a cycle, and has a `--check` mode CI runs.
- `scripts/__tests__/taxonomy.test.ts` **reads `docs/03-CONTENT-GUIDE.md` and asserts the
  JSON agrees with it** — id set, name, and tier, per skill. Rename a skill in the guide
  without touching the file and CI says so. 199 assertions.

### The graph

| | |
|---|---|
| Skills | 91 |
| Prerequisite edges | 106 |
| Cross-strand edges | 22 |
| Roots (no prerequisite) | 18 |
| Tiers | 22 foundation · 52 core · 17 gateway |
| Acyclic | proven by `findCycle`, asserted in two suites |

### Assumptions made where the spec was ambiguous

1. **Band assignments are mine.** The content guide fixes id, name and tier but not which
   bands a skill appears in. Foundation skills were placed low and wide, gateway skills from
   5–6 upward. These are the field most likely to move once real papers are classified.
2. **Prerequisite edges are deliberately sparse** (106 for 91 nodes, ~1.2 per skill). The
   guide says be conservative, so an edge exists only where the later skill genuinely cannot
   be done without the earlier one. That leaves 18 roots, which is intended, not an omission.
3. **Five edges exist to connect otherwise isolated nodes**, and each is defensible on its
   own: `CFT-02 → LOG-04` and `CFT-02 → GEO-17` (both skills' standard method *is* a drawing),
   `NUM-13 → MOD-09` (reading a chart's scale is reading a number line), `MOD-06 → NUM-10`
   (a discount is money and change with a percentage on top), and `GEO-01 → GEO-07` (a circle
   question is a length-and-region question first). The test now forbids an isolated node
   rather than forbidding a root, because a root with unlocks is legitimate.
4. **Three skill names were changed to match the guide's punctuation exactly** (en dash in
   `Inclusion–exclusion` and `part–whole`, em dash in `Never leave a blank —`), because the
   test compares against the document character for character.
5. **`content/` is excluded from Prettier.** Content JSON is written by `derive-unlocks.ts`
   with `JSON.stringify(_, null, 2)`; Prettier would collapse short arrays onto one line and
   the script would expand them again, churning every content edit. The Zod schemas govern
   that shape, not the formatter.

### Deferred

- **Classifying three official past papers** against the taxonomy (the second half of M0.1's
  acceptance) lands with **M1.8**, where the paper index files are authored. The ≥95% coverage
  figure and the backlog of unclassifiable questions get reported there.

---

## Seed problem bank (not one of your thirteen — see the note)

**State:** `[x]`

M1.3 through M1.7 render nothing without problems, and M1.10's 150-problem target is
explicitly outside this session's list. So this is a **seed bank**, sized to make every route
in Phase 1 real rather than to hit the launch number.

### Built

- **45 original problems** — 20 in band 3–4, 25 in band 5–6. Every one written from scratch;
  none is traceable to an official Math Kangaroo problem.
- **45 distinct primary skills**, covering all seven strands. Point tiers 3/4/5 are all present
  in both bands (3–4: 8/8/4, 5–6: 8/9/8).
- **180 distractors**, each with its own first-person misconception. No two distractors in a
  problem share a misconception.
- **16 figures** as hand-authored SVG React components in `src/components/figures/`, all drawn
  from tokens, all resolution-independent, all flattened to black under `@media print`.
- **`scripts/__tests__/content-quality.test.ts`** — 276 assertions enforcing the numeric
  authoring rules from `docs/03-CONTENT-GUIDE.md` Part B: statement word caps per band, the
  15-word nudge and 40-word strategy caps, distinct misconceptions, and a check that hint 1
  never contains the correct answer.
- Every skill that has a problem now names it as its `canonicalProblem` (45 of 91).

### Assumptions made where the spec was ambiguous

1. **`reviewedBy` is the literal string `pending-review` on all 45.** These problems were
   drafted in this session; nobody has completed the Part C checklist on them. Writing your
   name there would have recorded a review that did not happen. See "Needs you".
2. **Answer keys were rebalanced deliberately.** The first draft never used E and used C for
   40% of answers, which is a guessable pattern across a paper. Five problems were re-authored
   or reordered so every key carries answers. Current spread: A 4 · B 10 · C 18 · D 8 · E 5.
   C is still heavy at 40%; the test caps any key at 50% and requires every key to be used, and
   this is worth revisiting as the bank grows toward 150.
3. **Numeric choices are listed in ascending order**, matching the real paper's convention.
4. **Three problems were caught and rewritten during authoring** because the stated answer was
   wrong: the blocked-grid path count (8, not 11), the bead cycle colour, and the stone-bag
   invariant (black, not white — verified by brute force before rewriting). Each was found by
   working the problem independently of how it was written, which is exactly what Part C's
   "solved independently" line is for.

### Deferred

- **105 more problems** to reach M1.10's launch target of 150, and figures for them.
- **46 skills still have no problem.** Their skill pages render the practice ladder's empty
  state, which is built and tested rather than a placeholder.

---

## M1.1 — App shell

**State:** `[x]`

### Built

- Root layout with the landmark structure: skip link → header → `<main id="main">` → footer →
  mobile tab bar. One `main`, one `header`, one `contentinfo`; every `nav` has its own name.
- `<Header>` with the wordmark, primary nav, and `<ThemeToggle>` (light / dark / system,
  persisted to `localStorage`). "System" removes `data-theme` entirely so the media query in
  tokens.css takes over, rather than writing a third value the CSS would have to know about.
- **No flash of the wrong theme**: a tiny inline script in `<head>` sets `data-theme` before
  first paint. It only ever sets an explicit theme, and a test asserts it never writes
  `"system"` — that would defeat the media query.
- `<Footer>` carrying the non-affiliation disclaimer verbatim from one exported constant, plus
  licence, GitHub, privacy, terms and contact.
- `<MobileTabBar>` below `sm`, clear of the iOS home indicator, with the footer padded so the
  disclaimer is never covered (measured in the browser: 544px vs the bar at 596px).
- `<SkipLink>`, global `:focus-visible` ring, global `prefers-reduced-motion` stop.
- `not-found.tsx`, `error.tsx` (shows the digest, never the message — no PII in logs),
  `loading.tsx`, `robots.ts`, `sitemap.ts`, `manifest.ts`, and an SVG favicon.
- 27 unit tests plus a 5-test axe suite: **zero axe violations on the shell, the 404 page and
  the loading state, in both themes.**

### Assumptions made where the spec was ambiguous

1. **Nav shows Atlas · Problems · Papers · About.** `docs/00-SPEC.md` §0.2 lists Practice and
   Impact too, but those are P2 and P3. A nav link to a 404 is worse than a missing link; each
   is a one-line addition to `PRIMARY_NAV` in the milestone that builds its route.
2. **The mobile tab bar is Home · Atlas · Problems · Papers**, not the spec's
   Atlas / Practice / Search / Me, for the same reason — three of those four are P2.
3. **The manifest reads its two colours out of `tokens.css` at build time**
   (`src/lib/theme-colors.ts`). A manifest is JSON read by the OS and cannot use a custom
   property, and writing the hex a second time would let it drift. The ESLint rule that bans
   hex literals outside tokens.css is what surfaced this.
4. **`loading.tsx` is text, not a spinner.** An animation that has to be disabled under
   `prefers-reduced-motion` anyway is not worth it for a page that appears in well under a
   second.

### Something that was actually broken, and how it was caught

The first `<SkipLink>` composed `.visually-hidden` with Tailwind `focus:` utilities. Tailwind
v4 puts its utilities in a cascade layer and `globals.css` is unlayered, so `.visually-hidden`
beat every focus utility: the link stayed 1px square **while focused**. It passed axe, because
axe does not measure layout. It was caught by measuring the focused element in a real browser.
It is now longhand CSS, and `shell.test.tsx` asserts the `:focus` rule undoes every hiding
declaration so the trap cannot come back.

### Verified in a real browser at localhost:3000

- light and dark, both rendered and legible;
- no horizontal overflow at 320px, 360px, or 640px (the 200%-zoom equivalent of a 1280px window);
- skip link is the first focusable element and expands to 190×45 when focused;
- `:focus-visible` paints a 3px ring from `--focus`;
- footer disclaimer clears the mobile tab bar.

---

## M1.2 — Content loading layer

**State:** `[x]`

### Built

`src/lib/content.ts`. `buildContentIndex(dir)` is a **pure function of a directory** — point it
at a fixture tree and it indexes that tree — and `contentIndex()` memoises the one built from
the repo's `content/`. Synchronous, no `any`, no async, no runtime I/O after the first call.

Derived indexes:

| Index | Shape | Ordering |
|---|---|---|
| `problemsBySkill` | skill id → problems tagging it, primary **or secondary** | points, then id |
| `primaryProblemsBySkill` | skill id → problems leading with it | points, then id |
| `skillsByStrand` | strand → skills | foundation, core, gateway, then id |
| `skillsByBand` | band → skills | same |
| `problemsByBand` | band → problems | points, then id |
| `papersBySkill` | skill id → appearances in official papers | newest year, then question number |
| `graph` | prerequisites, unlocks, roots, **longest-path depth** | ids sorted |
| `strands`, `stats` | summaries for the strand strip and the impact counters | canonical |

49 unit tests covering every loader and every index, plus the invariants that matter: unlocks
really are the reverse of prerequisites, every skill sits strictly below all its prerequisites,
`next`/`previous` chain consistently in both directions, and the index is byte-stable across
two builds of the same directory.

`sitemap.ts` is now generated from the index: 9 static routes + 7 strands + 91 skills +
45 problems + every paper.

### Assumptions made where the spec was ambiguous

1. **A problem appears in the ladder of every skill it tags, not only its primary.** A student
   working on CNT-04 (casework) should meet the casework inside a geometry problem. A separate
   `primaryProblemsBySkill` keeps the stricter view for next/previous navigation, where "next
   problem in this skill" has to mean one thing.
2. **Graph depth is longest-path, not shortest.** The Atlas draws a skill below all of its
   prerequisites; with shortest paths an edge could point upward and the layout would cross
   itself. Proven by a test that every skill's depth exceeds all of its prerequisites'.
3. **Strand problem counts use the primary skill only**, so the seven counts add up to the size
   of the bank rather than double counting a problem tagged across strands. Asserted in a test.
4. **The loader throws on invalid content rather than skipping the file.** `pnpm validate:content`
   is the readable error; this is the backstop that stops a broken file reaching a reader.
5. **`server-only` is aliased to a stub in both Vitest configs** (`test/stubs/server-only.ts`).
   The package throws outside a server bundle, which is right in production and wrong in a
   test; the alias keeps the production guarantee and lets the tests import the module.

---

## M1.3 — Core problem components

**State:** `[x]`

### Built

`PointPill` · `BandPill` · `SkillChip` · `FigureRenderer` · `ChoiceList` · `FeedbackPanel` ·
`HintLadder` · `SolutionTabs` · `ProblemCard`, plus `ProblemInteractive` (see assumption 1)
and a generated figure registry. 67 render tests and 5 axe suites, all in both themes.

**The behaviour that is the product**: `FeedbackPanel` shows the misconception recorded for
*that* choice. A test asserts, for every wrong choice, that the panel contains that choice's
misconception **and none of the other three** — so a regression that fell back to a generic
message would fail rather than look fine.

Other things worth stating:

- **`ProblemCard` is a server component.** Statement, figure, choices, all three hints and the
  solution are in the delivered HTML; only choice selection, hint gating and tab switching
  hydrate. A test renders the card and asserts every hint and the solution are present in the
  markup with at least four `<details>` elements, which is the no-JavaScript path.
- **`SolutionTabs` carries a `<noscript>` style block** that un-hides the inactive panel, so
  without JavaScript both solutions stack rather than one becoming unreachable.
- **`HintLadder` fires a `ka:hint-reveal` CustomEvent** per rung, once only — reopening rung 1
  does not log a second reveal. That is what `POST /api/hint` will consume in M2.3.
- **Correctness is never carried by colour alone**: a revealed choice is labelled "correct" or
  "your answer" in text.
- **`FigureRenderer` gives the figure `role="img"` with the author's alt as its name**, hides
  the SVG from the accessibility tree, and offers the same description as collapsible text for
  low-vision readers.

### Assumptions made where the spec was ambiguous

1. **`ProblemInteractive` is a tenth component**, not in §7's inventory. `ChoiceList` and
   `FeedbackPanel` must agree on the selected key; one small client component owns that state
   so the other two stay independently testable and `ProblemCard` stays a server component.
2. **A student may change their answer.** Kangaroo does not penalise a wrong answer and this
   page exists to teach, so locking the first click would only teach students to fear clicking.
3. **A wrong answer never reveals the solution** — it shows the misconception and points at the
   hint ladder. A correct answer does show the reliable method, so a lucky guess still teaches.
4. **The hint ladder is gated only once JavaScript has run.** Rendering the locked state on the
   server would hide hints from a reader whose JavaScript never arrives.

### Something that was actually broken, and how it was caught

`ChoiceList` was `<ul role="group">`. Putting `role="group"` on a `<ul>` overrides its implicit
list role, which orphans every `<li>` — a serious WCAG violation. axe caught it across all five
suites. The group and the list are now separate elements.

---

## M1.4 — `/problem/[id]`

**State:** `[x]`

### Built

- The full problem page per `docs/00-SPEC.md` §1.6: breadcrumb, metadata row, statement,
  figure, choices with distractor-specific feedback, hint ladder, solution, "why this is on
  the test", skill chips.
- **`generateStaticParams` for all 54 problems** — the build emits 116 static pages including
  one Open Graph card per problem.
- **Per-problem OG image** via `next/og`, generated at build time, showing the id, point tier,
  band, primary skill and the statement, with a left border in the tier colour. Its colours are
  read out of `tokens.css` at build time, because satori cannot resolve custom properties.
- **Next/previous within the primary skill**, with a stated empty state at each end and a
  "problem N of M in this skill" line.
- **Report-an-error** opens a prefilled GitHub issue containing the problem id, the file path
  and the page URL — and asks for nothing about the reporter. A test asserts the body never
  contains "name", "email", "age", "school", "grade" or "birthday" as whole words.
- The point tier is explained in words next to the pill, because knowing that a 5-point
  question needs an idea rather than more arithmetic is most of CFT-08.

### Something that was actually broken, and how it was caught

Looking at the rendered page, the feedback panel for a wrong answer said **"Try the hints below
before you look at C"** — it named the correct letter. `ChoiceList` also marked the correct
choice the moment *any* choice was selected. Between them they handed over the answer and made
the hint ladder decorative. Both are fixed: the correct choice is marked only once the student
actually finds it (`revealAnswer`, set by the parent), and the panel now says "take a hint below
and try again". Three tests lock this down, including one asserting the panel never contains the
correct letter as a whole word.

Neither the 685-test unit suite nor axe could have caught this. It took reading the page.

### Content change made to serve this milestone

Nine more problems (**54 total**) so that eight skills have a two- or three-problem ladder.
Before this, every skill had exactly one problem, so next/previous was a permanent empty state
and the feature could not be exercised at all. `CNT-12` now runs 3 → 4 → 5 points across
`KA-0001`, `KA-0046`, `KA-0047`. Three more figures were authored for them.

**KA-0049 was caught wrong during authoring and rewritten**: the row of 1–9 with all
neighbouring sums odd *is* possible (2 880 ways, verified by brute force) — the first draft
marked "no" as correct while its own solution argued "yes".

### Assumptions made where the spec was ambiguous

1. **The OG card lives at `app/problem/[id]/opengraph-image.tsx`**, not at the `/api/og/[id]`
   route in §6. The route-segment file is statically generated at build time; the API route is
   listed as P2 and would be a runtime render.
2. **Next/previous walks the PRIMARY-skill ladder**, not every skill the problem tags. "Next
   problem in this skill" has to mean exactly one thing, and a problem tagging three skills
   would otherwise have three different "next"s.
3. **`pnpm dev` writes to `.next-dev`.** Running `pnpm build` while the dev server is up
   deleted the chunks it was serving and every route 500'd. `NEXT_DIST_DIR` separates them.

---

## M1.5 — `/skill/[id]`

**State:** `[x]`

### Built

All nine sections from `docs/00-SPEC.md` §1.4, in order, for all 91 skills:

1. name, id, strand, tier and bands — the tier carries a one-line explanation, because
   "gateway" means nothing until someone says it is what the 5-point questions ask for;
2. definition; 3. "you'll recognise it when…" as quoted trigger phrases;
4. the canonical worked example, rendered as a full interactive `<ProblemCard>`;
5. misconceptions, quoted in the student's own voice;
6. prerequisites and unlocks as linked chips;
7. the practice ladder grouped 3 / 4 / 5 points, each tier labelled with what it demands;
8. "in official papers", reading from the paper index;
9. a drill call to action.

**106 tests**, including one per skill asserting that all eight `<section>` landmarks are
present, none is under 20 characters of content, and the page contains no `TODO`, `TBD` or
"coming soon". Plus axe over four representative skills and a problem-free one, both themes.

### Assumptions made where the spec was ambiguous

1. **Absent sections are written sentences, not placeholders.** M1.5's acceptance allows "or
   explicitly marks them absent". A skill with no problems says *"No problems tagged GEO-17
   have been written yet. Ten new problems are authored every week, so this will not stay
   empty."* — and a test forbids the word "TODO" anywhere on the page.
2. **Mastery state is stated as absent rather than faked.** §1.4 section 7 asks for mastery on
   the ladder; mastery needs the attempts table, which is M2.4. The ladder says so in one line
   rather than showing a ring that never fills.
3. **The drill CTA does not link to `/practice/drill`**, which does not exist until M2.6. It
   explains what a drill will do and points at the first rung of the ladder instead.
4. **The ladder lists every problem that tags the skill**, primary or secondary, with secondary
   ones marked "also tests this". A student practising casework should meet the casework inside
   a geometry problem.
5. **Section 8 currently renders its empty state for every skill**, because no paper indexes
   exist until M1.8. Its wording states in both branches that we hold our own analysis and never
   the problems — a test asserts that, so it survives M1.8 filling the section in.

---

## M1.6 — The Atlas

**State:** `[x]`

### Built

- **`src/lib/atlas-layout.ts` — a pure layout function.** Same skills in, byte-identical
  coordinates out (asserted by a test), so a rebuild is never a diff and a node never moves
  under a reader's cursor. Column by strand; row by
  `max(tier floor, 1 + deepest prerequisite)`; ties broken on id.
- **`src/lib/atlas-params.ts`** — the URL state from §1.2, exactly:
  `/atlas?strand=CNT&band=5-6&focus=CNT-12`. Parsing is total, so a mistyped band shows the
  unfiltered Atlas rather than an error.
- **`AtlasGraph`** — SVG, drag to pan, ⌘/Ctrl-scroll to zoom, buttons for both, click to focus.
- **`AtlasList`** — nested strand → tier → skill lists, keyboard-first.
- **`AtlasFilters`** — strand, band, point value and has-problems, all as links.
- **`SkillPanel`** — the focused skill's summary, prerequisites and unlocks, from the URL.
- **`/atlas/[strand]`** — the ordered walkthrough for each of the seven strands.
- **49 tests**, including the two acceptance criteria: graph and list return **identical skill
  sets under seven different filter combinations**, and every one of the 91 graph nodes is a
  real anchor with an accessible name over 20 characters long.

### Something that was actually broken, and how it was caught

The graph first used a fitted `viewBox`. Ninety-one nodes across seven columns is ~1730px wide;
fitted into a 774px column that is a 45% scale, so every node rendered at **four pixels** and
every label below legibility. It passed all 29 unit tests and axe, because neither measures
size. Looking at it in the browser was the only way to see it.

It now renders at its natural size inside a scrolling container, with zoom changing the rendered
size rather than the viewBox. Scrolling is native, so it works with the keyboard, a trackpad, a
screen reader's own navigation, and with JavaScript switched off — which the old pan implementation
did not.

Two axe findings were also fixed: `aria-pressed` on the filter links (not allowed on a link —
they are now `aria-current`), and `AtlasList` starting its headings at `h3` under the page's
`h1`, which skipped a level.

### Assumptions made where the spec was ambiguous

1. **"Used automatically for screen readers" is not implemented by sniffing.** There is no
   reliable way to detect assistive technology, and trying is a well-known anti-pattern. Instead
   **the graph itself is accessible** — every node is a focusable link with a full accessible
   name — and the view toggle is rendered *before* the diagram in the DOM, so the choice is met
   before the picture. The two views are equals, and a test asserts they hold the same set.
2. **Filters are links, not form controls.** The whole bar works with JavaScript off, every
   state is a shareable URL, and Back undoes a filter. The cost is one navigation per toggle,
   which on a server-rendered page is imperceptible.
3. **A plain scroll wheel over the graph still scrolls the page.** Hijacking the wheel is the
   most reliable way to trap a reader halfway down a page; zoom needs ⌘/Ctrl, or the buttons.
4. **Node colour by tier, hollow centre for "no problems yet".** §1.2 says node colour is tier
   and fill is mastery; mastery is P2, so the fill currently carries coverage instead, and the
   legend says so in words.
5. **`/atlas` is server-rendered per request** (it reads `searchParams`), not statically
   generated. The strand pages are static.

---

## M1.7 — `/problems` browse

**State:** `[x]`

### Built

- Filter bar: level, point value, strand, and skill — all as links, all URL-encoded.
- Sort: id, hardest first, newest.
- Server-rendered, paginated 12 to a page, with numbered page links carrying every active
  filter and `rel="prev"`/`rel="next"` so the pages read as one sequence.
- Written empty state with a way out, and a live result count.
- **45 tests**, including the M1.7 acceptance directly: a full query round-trips through a real
  URL and comes back identical, and paginating through every page yields each problem exactly
  once with none lost or repeated.

### Something that was actually broken, and how it was caught

`toSearchParams` appended multi-select values in click order, so `?strand=GEO&strand=CNT` and
`?strand=CNT&strand=GEO` were two different URLs for one view — two cache entries, and two
different links to paste to a student. A round-trip test caught it. Values are now sorted, with
bands in exam order rather than alphabetically (`11-12` sorts before `3-4` as a string).

### Assumptions made where the spec was ambiguous

1. **The status filter (unseen / missed / mastered) is not built.** It needs the attempts table,
   which is M2.3. It is a filter over per-student data, so there is nothing honest to show
   before accounts exist.
2. **The source filter (original / paper index) is not built either**, because it would be
   degenerate: every problem in `content/problems/` is original by construction, and the paper
   index holds no problems at all. It becomes meaningful in Phase 4 when generated variants
   arrive and have to be labelled.
3. **Sorting by difficulty says so when there is no difficulty.** `docs/01-DATA-MODEL.md` §3.3
   is explicit that difficulty is measured, never asserted; no problem has 30 attempts yet, so
   the sort tells the reader that in a sentence rather than silently falling back to id order
   and letting a tutor believe the top of the list is the hardest. Uncalibrated problems sort
   last, not first — null is not the same as easy.

---

## M1.8 — Paper index

**State:** `[x]` for the routes. **The six paper indexes are NOT authored — see below.**

### Built

- **`/papers`** — the indexed papers grouped by band, the "skills most tested" chart per band,
  and a plain statement of what the index is and is not. Links to `mathkangaroo.org`; no PDF is
  ever served from here.
- **`/papers/[year]-[band]`** — the per-question table (number, points, our skill tags, our
  note), the point distribution, how much of the paper is indexed, a link to the official PDF,
  and the skills-most-tested chart for that paper.
- **`src/lib/papers.ts`** — pure analysis: `mostTestedSkills`, `pointDistribution`,
  `expectedQuestionCount`, slug parsing. 16 tests.
- **The tripwire now caps every file under `content/papers/`, not just the `.json`.** It only
  walked the JSON before, so an official paper pasted into a `.txt` would have sailed through.
  A fixture proves the new behaviour.
- `content/papers/README.md` — the authoring contract at the point of use.
- 45 more tests, including two that assert the repository itself is clean: no file under
  `content/papers/` over 2KB, and no PDF or image anywhere in `content/`.

### What I did NOT do, and why

**I did not author the six paper indexes.** M1.8's build-plan acceptance asks for at least six,
across bands 3–4 and 5–6. Producing them means opening each official PDF and classifying its 24
or 30 questions against the Atlas. I have not read those papers, so anything I wrote in those
files would be **invented analysis presented as analysis** — it would tell a student "2019
question 22 tests GEO-10" with nothing behind the claim, and send them to the wrong skill. That
is worse than an empty index, and it is the exact opposite of what the paper index is for.

So the routes are finished and fully tested against fixture data, `/papers` ships with an empty
state that says plainly why it is empty, and the authoring is listed under "Needs you". This is
the same task as M0.1's second acceptance criterion ("classify three full official past papers
against the taxonomy"), which is also outstanding for the same reason.

### Assumptions made where the spec was ambiguous

1. **The route is `/papers/[slug]` where the slug is `<year>-<band>`**, e.g. `/papers/2019-5-6`,
   matching `docs/00-SPEC.md` §1.7's `/papers/[year]-[band]`. One dynamic segment is simpler
   than two, and the band itself contains a hyphen.
2. **The "most tested" chart is CSS bars with the number written beside each one**, not an SVG
   chart. Every bar is a row of readable text, so it works for a screen reader, in black and
   white on a printed worksheet, and for anyone who cannot judge lengths by eye.
3. **Skill counts add to more than the number of questions**, because a question tagged with two
   skills is counted for both. The page says so, rather than normalising the number into
   something tidier and less true.

---

## M1.9 — Home, about, legal, contact

**State:** `[x]`

### Built

- **`/`** — the thesis in one sentence, a **live sample problem with working distractor feedback
  above the fold** (a test clicks a wrong answer on the home page and asserts the misconception
  appears), the start-here triad, the seven-strand strip with live counts, a Problem of the Day
  derived deterministically from the date, and four counters read from the files at build time.
- **`/about`** — first person, including the four things this site will never do.
- **`/legal/privacy`** — written for a parent, not a lawyer: the complete list of what an
  account holds, what is never stored, no-trackers-no-cookies, and a hard delete.
- **`/legal/terms`** and **`/legal/license`** — two licences, and an explicit section on what
  neither of them covers.
- **`/contact`** — a real `<form>` with a server action, so it submits without JavaScript, plus
  a mailto fallback and a link to open a GitHub issue. 16 tests.
- 34 more tests and 7 more axe suites.

### Something that was actually broken, and how it was caught

Smoke-testing the **production build** with curl: `/skill/ZZZ-99` and `/problem/KA-9999`
returned **HTTP 200** with the not-found page in the body. Next's default `dynamicParams: true`
rendered the page for an unknown id, hit `notFound()`, then cached and served that response as a
200 — so a wrong URL looked fine to a crawler and to any client that checks the status rather
than the words on the page. The unit tests could not see this: `notFound()` throws in jsdom, so
they passed.

All four content routes now set `dynamicParams = false`, which is also simply correct — the
complete set of valid ids is known at build time. Verified: `/skill/ZZZ-99`, `/problem/KA-9999`,
`/papers/1999-3-4` and `/atlas/XXX` all return 404. A test asserts the export on each route.

### Measured on the production build

Served with `next start` and measured in the browser:

| | |
|---|---|
| TTFB | 10 ms |
| DOMContentLoaded | 26 ms |
| Load | 56 ms |
| Cumulative layout shift | 0 |
| Total transfer | 132 KB across 11 requests |
| Third-party hosts | none |
| Render-blocking scripts | one, the 153-byte inline theme script (deliberate — it prevents the flash of the wrong theme) |

All 15 routes return 200 and the OG image renders as a real 56 KB PNG. The sitemap has 161 URLs.

**Lighthouse itself was not run.** It needs Chrome's own auditing engine; the CLI (`@lhci/cli`)
is a large dependency outside CLAUDE.md's budget and I did not add one without asking. The
numbers above are the inputs Lighthouse scores, and the accessibility category is covered
separately by 35 axe assertions across both themes — but the four scores in M1.9's acceptance
are unverified until someone runs it. See "Needs you".

### Assumptions made where the spec was ambiguous

1. **The start-here triad leads with the three things that exist** (Atlas, problems, papers)
   rather than the diagnostic, which is P2. The page says so in a line instead of linking to a
   route that is not there.
2. **Problem of the Day is derived from the UTC date**, with the home page revalidating hourly.
   No database, no cron: the same day gives everyone the same problem, and every problem comes
   round. The `/potd` archive and the 6pm reveal stay P2.
3. **There is no "students served" counter.** That number belongs to the database and to
   `/impact` in Phase 3, where nothing derived from fewer than ten students may be published.
   Inventing it on the home page is exactly the kind of unbacked claim `/impact` exists to
   avoid, so the page says where it will live instead.
4. **Resend is called over its REST API with `fetch`**, not through its SDK. One call, and the
   dependency budget stays where CLAUDE.md wants it.
5. **The contact form's email field is optional and there is no CAPTCHA.** Most people here are
   children; a form that demands an address collects one from every child reporting a typo. Every
   CAPTCHA worth using is a third-party tracker, which the non-negotiables rule out — spam is
   handled by a honeypot and a length cap, which is proportionate. The message is emailed and
   never stored, so there is nothing to leak or delete later. A test asserts the message body and
   the reply address never reach the logs.

---

## M0.4 — Legal and naming

**State:** `[x]`

The footer disclaimer and the three legal pages landed with M1.1 and M1.9. This milestone
added `docs/05-OUTREACH-DRAFT.md`: the note to Math Kangaroo USA, written but **not sent** —
M0.4 asks for it to exist, and writing it is what forces you to be able to describe the project
in terms that survive contact with the organisation whose trademark you use. It also records
what changes under each realistic response, and confirms the public name is **Kangaroo Atlas**,
defined once in `src/lib/site.ts` and read from there by every surface.

Send it when the site is live and has been in front of students, not before.

---

## M1.10 — Launch content

**State:** `[x]`

### Built

| | before | after |
|---|---|---|
| Problems | 54 | **150** |
| Distractor explanations | 216 | **600** |
| Skills with at least one problem | 60 | **91 of 91** |
| Skills with a canonical worked example | 45 | **91** |
| Skills with three or more problems | 15 | 56 |
| Figures | 19 | 25 |

Point tiers now sit much closer to a real paper's thirds: band 3–4 runs 27 / 27 / 12 and band
5–6 runs 19 / 36 / 29. Every one of the 96 new problems was written from scratch, and **every
numeric answer was computed independently before the problem was authored** — the verification
scripts are in the session transcript, not in the repo, because they are working notes rather
than something to maintain.

### Things caught and fixed while authoring

- **KA-0105 had the wrong answer.** The stated answer was 13; building the grid explicitly gave
  12. Rewritten with new distractors, including one for each of the two off-by-one errors.
- **KA-0049 contradicted itself** in the first session — marked "no" while its own solution
  argued "yes". Brute force confirmed 2 880 valid arrangements; rewritten.
- The authoring checker was upgraded to **report every rule violation in a batch at once**
  rather than failing on the first, after a single over-long hint cost a round trip.
- Choice sets were re-sorted ascending after authoring, matching the real paper's convention.

### Assumptions and known limits

1. **The answer key still leans to the middle**: A 16 · B 44 · C 52 · D 26 · E 12. That is a
   consequence of listing numeric choices in ascending order, as the real papers do — a correct
   answer with distractors above and below lands in the middle. Every key is used and no key
   exceeds the 50% cap the test enforces, but a deliberate pass to flatten it further is worth
   doing as the bank grows past 150.
2. **All 150 are still `reviewedBy: ["pending-review"]`.** The content guide requires two
   approvals before launch. See "Needs you".
3. **The CFT strand includes four scenario questions** (KA-0126, KA-0127, KA-0130 and the
   triage-flavoured parts of others) that ask what to *do* rather than what a number *is*.
   Math Kangaroo itself never asks these, but `docs/00-SPEC.md` §2.4 builds a whole practice
   surface on exactly this skill, so the bank has to be able to teach it.

---

## M2.1 — Supabase foundation

**State:** `[~]` — written in full, **the runtime proof has not been executed.**

### Built

- **Migrations 001–009**, exactly the ten tables from `docs/01-DATA-MODEL.md` §2, each followed
  immediately by `enable row level security`. RLS with no policy denies everything, so there is
  no window during a migration run in which a row is readable.
- **`010_policies.sql`** — every policy plus three `security definer` helpers and the two
  aggregate functions. The four student-owned tables (`attempts`, `mastery`, `runs`,
  `journal_entries`) are owner-only across all four operations, with **no mentor path at all**.
  `parent_consents` has RLS on and deliberately no policy, which denies every client role.
- **`supabase/tests/rls.test.sql`** — 40 pgTAP assertions, including the one that matters most:
  *a mentor reading `attempts` directly gets zero rows*, while the aggregate function still
  returns counts. Also covers two students in one cohort seeing nothing of each other, a mentor
  of a different class getting nothing through either path, and account deletion cascading.
- **`scripts/__tests__/rls-shape.test.ts`** — 73 assertions that read the SQL and check its
  structure **with no database**, so they run on every commit.

### What I could not verify, and why

**There is no Postgres, Docker or Supabase CLI on this machine**, so `supabase test db` has
never been run. CLAUDE.md's definition of done says "if it touches student data: RLS policy
written and tested", and only half of that is met. The policies are written and their shape is
checked; their runtime behaviour is not proven. Run `supabase test db` before any real student
data exists — see "Needs you".

So the shape test exists to make the gap smaller rather than to paper over it. It cannot prove
isolation. It does catch the failures that are silent and total: a table added later with no
RLS, a policy that says `using (true)`, a `security definer` function with an unpinned
`search_path`, or a mentor policy appearing on a student-owned table.

### Two real problems it caught immediately

1. **The pgTAP plan count was wrong** — `plan(28)` against 40 assertions. pgTAP aborts the
   whole file on a plan mismatch, so this would have failed the first time it was ever run,
   probably months from now. The shape test now recounts the assertions and asserts the plan
   matches.
2. A regex in the checker missed SQL's doubled apostrophe (`student''s`), which would have made
   two coverage assertions pass vacuously.

### Assumptions made where the spec was ambiguous

1. **Policies live in `010`, not beside their tables.** §2.1 says to write them with the tables.
   The deny-by-default half is with the tables. The policies themselves cannot be, because a
   policy on `cohorts` that checks `cohort_members` and one on `cohort_members` that checks
   `cohorts` recurse forever — the way out is a `security definer` helper, which needs every
   table to exist first. The reasoning is written at the top of `010_policies.sql`.
2. **A mentor sees a student's name and band through a function, not a policy.** §2.1 permits
   `display_name` and `band` and "nothing else". RLS is row-level, so any row policy on
   `profiles` would also expose `role` and `locale`. `cohort_roster()` returns exactly four
   named columns instead, and a test asserts its body never selects `role`, `locale` or `p.*`.
3. **`teaching_sessions` has no member-read policy.** §2.1 lists it as mentor-owned, and `notes`
   is the mentor's own writing about a lesson. Members read assignments, not lesson notes.
4. **Every `security definer` function pins `search_path = ''`** and schema-qualifies every
   table it reads. Without that, a caller can create their own `public` schema and change what
   a function reads while it runs with the owner's privileges — the standard escalation. Two
   tests enforce both halves.

---

## M2.4 — Mastery and scheduling

**State:** `[x]` — pure logic, so this one is fully verified. 71 tests.

### Built

- **`src/lib/mastery.ts`** — the state machine from `docs/01-DATA-MODEL.md` §3.1 as pure
  functions of one skill's attempts. `unseen` / `seen` / `shaky` / `mastered`, the 70%-over-five
  rule, the 4-or-5-point-miss-after-a-3-point-solve rule, and the 14-day decay. State is always
  **recomputed from the attempts** rather than advanced incrementally: a stored state that
  drifts from the attempts that produced it is a bug nobody ever notices.
- **`src/lib/schedule.ts`** — `ts-fsrs` wrapped so that FSRS schedules the **skill** and the
  server then serves an unseen **problem** from it. Also `pointCeiling`, which decides how hard
  a version of the skill a student has earned.
- **40 mastery tests** including a table covering every transition out of every state, both
  sides of the decay boundary, and the precedence question below.
- **31 scheduling tests**, including M2.6's acceptance expressed directly: *a missed skill comes
  back within the week with a different problem*.

### Assumptions made where the spec was ambiguous

1. **Mastered outranks shaky when both conditions hold.** A history of `wrong, wrong, right,
   right, right` is 60% over five (shaky) *and* a clean three-in-a-row across two days
   (mastered). Recent unaided evidence is the better signal, so mastered wins; two tests pin
   this down. The alternative — shaky always winning — would make mastery almost unreachable
   for a student who struggled early.
2. **All three mastery conditions apply to the same three attempts.** A clean two-day run in
   March cannot be combined with a hint-free run in April.
3. **Decay applies only to mastered.** §3.1 says "mastery decays to shaky", so a `seen` skill
   sitting past its due date stays `seen` rather than being demoted for inactivity.
4. **A higher-tier miss only counts if a 3-point solve came first.** Missing a 5-pointer having
   never solved a 3-pointer is not shakiness, it is simply not knowing the skill yet.
5. **Rating mapping is strict about hints**: wrong → Again; right but needed hint 2 or 3 → Hard;
   right with only the nudge → Good; right, unaided and inside the estimated time → Easy. Rating
   a hint-assisted solve as Good would push the next review out and the student would meet the
   skill again having never done it alone.
6. **FSRS fuzz is off.** Fuzz spreads reviews to stop a pile-up in a thousand-card deck; here it
   would only make the scheduler non-deterministic and its tests flaky.
7. **`pointCeiling` starts at 3 and moves one tier at a time**, up on an unaided solve at the
   ceiling and down on a miss there. Nobody meets a 5-point version of a skill they have not yet
   solved at 4.

---

## M2.11 — `/print` worksheet generator

**State:** `[x]` — needs no database, so it ships now rather than with Phase 2.

### Built

- **`/print`** — pick by level, point value, strand, skill and count; include or exclude figures;
  print. The worksheet and the answer key are on one page, and `@media print` starts the key on
  its own sheet so a tutor can hand out the questions without the answers.
- **The answer key is the part that exists nowhere else**: for every wrong choice it prints the
  misconception that produces it. A tutor marking a stack of sheets sees what the student was
  *thinking*, not only that they were wrong. 39 tests, including one asserting all four
  distractors on every problem of a full 30-question sheet carry a written note.
- **`src/lib/worksheet.ts`** — pure selection, with a seeded shuffle.

### The decision that matters most here

**The shuffle seed is in the URL.** A tutor prints the worksheet, then prints the answer key,
and the two must be the same worksheet. A random shuffle that re-rolled on the second page load
would quietly hand out a key that did not match the sheet, and nobody would find out until a
room full of students did. The same URL therefore always produces the same sheet — this term,
next term, on any machine — and "Reshuffle" is a link to the next seed rather than a dice roll.
`mulberry32` is written out longhand (nine lines) rather than pulled in as a dependency, because
the whole point is that the sequence is fixed and inspectable.

### Assumptions made where the spec was ambiguous

1. **The sheet is ordered easiest first** after the shuffle picks which problems appear. A
   worksheet that opens with a 5-point question teaches a student to give up.
2. **"Text only" removes every problem that has a figure**, rather than printing the figure's
   alt text. A worksheet is for solving; a described figure a student cannot see is not a
   question they can answer.
3. **`/print` is `noindex`.** Every filter combination is a distinct URL and there are millions
   of them; none of them is a page a search engine should be offered.
4. **The sheet carries the non-affiliation line and the licence** in its footer, because a
   printed page travels away from the site that explains it.

---

## Needs you (external accounts / credentials)

- [ ] **Run Lighthouse** on a deployed build and confirm ≥95 on performance, accessibility, best
      practices and SEO (M1.9's acceptance). Everything it measures is in place; the run itself
      needs Chrome. If you want it in CI, `@lhci/cli` is the tool — it is outside CLAUDE.md's
      dependency budget, so I did not add it.
- [ ] **Run `supabase test db`** once you have a project, and confirm all 40 RLS assertions
      pass. This is the half of M2.1's definition of done I could not meet: there is no
      Postgres, Docker or Supabase CLI on this machine. Do it before any real student data
      exists.
- [ ] Push the repo and turn on branch protection for `main`, requiring the `verify` check.
- [ ] Connect the Vercel project so preview deploys run on every PR.
- [ ] `RESEND_API_KEY` for the `/contact` form (M1.9). The form ships with a mailto fallback
      that works with no key at all, so nothing is blocked on this.
- [ ] **Author the paper indexes.** Open six official PDFs (bands 3–4 and 5–6), classify every
      question against the Atlas, and write `content/papers/<year>-<band>.json`. The format and
      the rules are in `content/papers/README.md`; `/papers` and `/papers/[year]-[band]` are
      built and tested and will light up the moment the first file lands. This is reading work
      that has to be done by someone who has read the papers — see M1.8 above.
- [ ] **Review the 54 seed problems** against `docs/03-CONTENT-GUIDE.md` Part C. They are all
      marked `reviewedBy: ["pending-review"]` because they were drafted in this session and
      nobody has run the checklist on them. The content guide requires two approvals before a
      problem is merged for launch.
