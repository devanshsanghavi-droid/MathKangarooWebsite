# CLAUDE.md - Kangaroo Atlas

Repo: `git@github.com:devanshsanghavi-droid/MathKangarooWebsite.git`
Owner: Devansh Sanghavi. Read this file before every task.

## What this is

A free, open web platform for Math Kangaroo preparation, organized by **skill** rather than
by past-paper year. It is the real infrastructure behind a tutoring program that serves ~60
students a year - not a demo. Three things make it what it is:

1. **The Skill Atlas** - ~91 named atomic skills (growing to ~140) in a prerequisite graph.
2. **An original problem bank** - every problem written from scratch, tagged into the Atlas.
3. **Distractor-specific explanations** - each wrong answer choice stores the exact
   misconception that produces it, so feedback is written for the student's actual error.

## Non-negotiables

These are hard rules. If a task appears to require breaking one, stop and say so.

- **Never reproduce official Math Kangaroo problems.** Not the text, not a close reword, not
  the figures. We link to the official free PDFs and publish our own *skill index* of them.
  Every problem in `content/problems/` is original work by a named author.
- **Every wrong answer choice must have a written `misconception`.** CI fails the build
  otherwise. This is the product.
- **Every figure must have author-written `alt` text.** CI fails the build otherwise.
- **Practice never requires an account.** Auth exists only to save progress. Nothing is ever
  paywalled and there is no premium tier.
- **The users are minors.** No third-party trackers, no ad networks, no PII beyond a first
  name and (for cohort accounts) a parent-consent record. Analytics are self-hosted and
  cookie-free. Treat COPPA as a build constraint, not a legal appendix.
- **Trademark hygiene.** "Math Kangaroo" is used descriptively only. Every page footer
  carries: *"Independent project. Not affiliated with or endorsed by Math Kangaroo in USA,
  NFP."*
- **Green, red and amber are reserved.** They appear only in response to something the student
  did: correct, incorrect, hint taken. Never for difficulty, never for a category, never for
  decoration. If a component needs a colour and none of the reserved three apply, it uses a
  neutral or the single teal accent - there is no fourth option. `pnpm check:palette` fails the
  build on a violation. See `docs/05-DESIGN-DIRECTION.md` §2.
- **Accessibility is not a phase.** WCAG 2.1 AA contrast, full keyboard operation, visible
  focus, `prefers-reduced-motion` respected. A component that fails this is not done.
- **No scope creep.** Forums, leaderboards, AMC content, video courses, AI tutors: all
  out of scope. If it isn't in `docs/00-SPEC.md`, it doesn't get built.

## Stack

Chosen for capability at zero recurring cost. Everything below has a free tier that covers
this project's realistic scale.

| Layer | Choice | Cost |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict | free |
| Styling | Tailwind CSS v4 + CSS custom properties for theme tokens | free |
| Math typesetting | KaTeX (`react-katex`) | free |
| Figures | Hand-authored inline SVG React components | free |
| Content | JSON + MDX committed to the repo - **git is the CMS** | free |
| Validation | Zod schemas + a `pnpm validate:content` script run in CI | free |
| Database & auth | Supabase (Postgres, Auth, RLS) - free tier | free |
| Spaced repetition | `ts-fsrs` | free |
| Hosting | Vercel Hobby | free |
| Analytics | Umami, self-hosted on the same Supabase Postgres | free |
| CI | GitHub Actions | free |
| Email (parent digests) | Resend free tier (3k/mo) | free |

Only recurring cost is an optional domain (~$12/yr). Until then, ship on `*.vercel.app`.

## Commands

```bash
pnpm dev                 # local dev server
pnpm build               # production build (must pass before any PR)
pnpm lint                # eslint + prettier check
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest unit tests
pnpm validate:content    # zod-validate every skill + problem JSON file
pnpm check:palette       # reserved-colour rule: no green/red/amber outside feedback
pnpm a11y                # axe-core run against key routes
pnpm db:types            # regenerate Supabase types into src/lib/db.types.ts
```

## Repo layout

```
content/
  skills/<STRAND>/<ID>.json        one file per skill
  problems/<band>/<ID>.json        one file per problem
  papers/<year>-<band>.json        skill index of an official past paper
  essays/*.mdx                     methodology essays
src/
  app/                             Next.js App Router routes
  components/                      shared UI
  components/figures/              one React component per problem figure
  lib/                             schemas, db client, mastery, fsrs, scoring
  styles/tokens.css                the only place colors are defined
scripts/                           validate-content.ts, calibrate.ts, seed.ts
supabase/migrations/               SQL migrations, numbered
docs/                              the specs below - read before building
```

## Documents

- `docs/00-SPEC.md` - every route, page, and component. The definition of the product.
- `docs/01-DATA-MODEL.md` - content schemas, Postgres tables, RLS, mastery + scheduling.
- `docs/02-BUILD-PLAN.md` - the phased checklist. Work top to bottom.
- `docs/03-CONTENT-GUIDE.md` - the 91-skill taxonomy and problem authoring rules.
- `docs/04-CLAUDE-CODE-PROMPTS.md` - session kickoff prompts.
- `docs/05-DESIGN-DIRECTION.md` - the v2 palette, type and unit structure. Supersedes §0.1 of
  `00-SPEC.md` and the structure of `/skill/[id]` described there.

## Conventions

- TypeScript `strict: true`. No `any`. No non-null assertions without a comment explaining why.
- **All colors come from `src/styles/tokens.css`.** Never write a hex literal in a component.
  Light and dark are both first-class; test both before calling anything done. The token set,
  the type scale and the shape scale are defined by `docs/05-DESIGN-DIRECTION.md`, which
  supersedes `docs/00-SPEC.md` §0.1.
- Server Components by default. `"use client"` only where interaction genuinely requires it.
- Content files are the source of truth. Never hardcode a problem or skill in a component.
- Figures are React components in `components/figures/`, referenced by id from problem JSON.
  They must be resolution-independent, theme-aware (use tokens), and print cleanly in black.
- Every route gets `generateMetadata` with a real title, description, and OG image.
- Commit messages: `area: what changed` (e.g. `atlas: add prerequisite edge rendering`).

## Definition of done

A task is not complete until all of these pass:

- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content &&
      pnpm check:palette` clean
- [ ] Works in light and dark theme
- [ ] Keyboard-operable with a visible focus state
- [ ] Readable at 360px wide and at 200% zoom
- [ ] No console errors or warnings
- [ ] New content files validate against their Zod schema
- [ ] If it touches student data: RLS policy written and tested

## How to work with me

- Read `docs/00-SPEC.md` for the surface you are building before writing code.
- Prefer finishing one route completely over scaffolding five.
- When the spec is ambiguous, pick the simpler option and note the assumption in the PR body.
- Do not add dependencies without saying why in the commit message. The dependency budget is
  deliberately small.
