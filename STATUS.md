# STATUS

Running log of the build. Updated as each milestone lands, not at the end.

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started · `[!]` blocked on Devansh

| Milestone | State | Landed |
|---|---|---|
| git init + docs baseline | `[x]` | `docs: add project constitution, specs, and build plan` |
| M0.2 — repo and rails | `[~]` | |
| M0.3 — content guardrails | `[ ]` | |
| M0.1 — taxonomy (91 skills) | `[ ]` | |
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

**State:** `[~]`

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

## Needs you (external accounts / credentials)

- [ ] Push the repo and turn on branch protection for `main`, requiring the `verify` check.
- [ ] Connect the Vercel project so preview deploys run on every PR.
- [ ] `RESEND_API_KEY` for the `/contact` form (M1.9). The form ships with a mailto fallback
      that works with no key at all, so nothing is blocked on this.
