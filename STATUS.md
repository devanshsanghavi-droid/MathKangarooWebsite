# STATUS

Running log of the build. Updated as each milestone lands, not at the end.

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started · `[!]` blocked on Devansh

| Milestone | State | Landed |
|---|---|---|
| git init + docs baseline | `[x]` | `docs: add project constitution, specs, and build plan` |
| M0.2 — repo and rails | `[x]` | `rails: scaffold next 15 app, design tokens, content schemas, validation, and CI` |
| M0.3 — content guardrails | `[x]` | `content: add the five CI guardrails with proving fixtures` |
| M0.1 — taxonomy (91 skills) | `[x]` | `atlas: author all 91 skills and derive the prerequisite graph` |
| seed problem bank | `[x]` | `content: author 45 original problems and 16 figures` |
| M1.1 — app shell | `[x]` | `shell: build header, footer, theme toggle, and a11y primitives` |
| M1.2 — content loading layer | `[x]` | `content: add typed loaders, derived indexes, and a generated sitemap` |
| M1.3 — problem components | `[x]` | `problem: build the nine problem components with distractor-specific feedback` |
| M1.4 — `/problem/[id]` | `[x]` | `problem: build the problem page with OG images and in-skill navigation` |
| M1.5 — `/skill/[id]` | `[x]` | `skill: build the skill page with all nine sections` |
| M1.6 — the Atlas | `[ ]` | |
| M1.7 — `/problems` browse | `[ ]` | |
| M1.8 — `/papers` | `[ ]` | |
| M1.9 — home, about, legal, contact | `[ ]` | |

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

## Needs you (external accounts / credentials)

- [ ] Push the repo and turn on branch protection for `main`, requiring the `verify` check.
- [ ] Connect the Vercel project so preview deploys run on every PR.
- [ ] `RESEND_API_KEY` for the `/contact` form (M1.9). The form ships with a mailto fallback
      that works with no key at all, so nothing is blocked on this.
- [ ] **Review the 45 seed problems** against `docs/03-CONTENT-GUIDE.md` Part C. They are all
      marked `reviewedBy: ["pending-review"]` because they were drafted in this session and
      nobody has run the checklist on them. The content guide requires two approvals before a
      problem is merged for launch.
