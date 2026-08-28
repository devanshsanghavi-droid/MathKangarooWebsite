# STATUS

Running log of the build. Updated as each milestone lands, not at the end.

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started · `[!]` blocked on Devansh

| Milestone | State | Landed |
|---|---|---|
| git init + docs baseline | `[x]` | `docs: add project constitution, specs, and build plan` |
| M0.2 — repo and rails | `[x]` | `rails: scaffold next 15 app, design tokens, content schemas, validation, and CI` |
| M0.3 — content guardrails | `[x]` | `content: add the five CI guardrails with proving fixtures` |
| M0.1 — taxonomy (91 skills) | `[x]` | `atlas: author all 91 skills and derive the prerequisite graph` |
| seed problem bank | `[ ]` | |
| M1.1 — app shell | `[ ]` | |
| M1.2 — content loading layer | `[ ]` | |
| M1.3 — problem components | `[ ]` | |
| M1.4 — `/problem/[id]` | `[ ]` | |
| M1.5 — `/skill/[id]` | `[ ]` | |
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

## Needs you (external accounts / credentials)

- [ ] Push the repo and turn on branch protection for `main`, requiring the `verify` check.
- [ ] Connect the Vercel project so preview deploys run on every PR.
- [ ] `RESEND_API_KEY` for the `/contact` form (M1.9). The form ships with a mailto fallback
      that works with no key at all, so nothing is blocked on this.
