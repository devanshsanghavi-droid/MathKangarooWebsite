# Kangaroo Atlas

A free, open web platform for **Math Kangaroo** preparation, organized by _skill_ rather than
by past-paper year.

Every other free resource is a pile of past papers. You take the 2019 test, you score 68 out
of 120, and neither you nor your tutor learns anything you can act on. This is the diagnosis,
made into software.

Three things make it what it is:

1. **The Skill Atlas** — ~91 named atomic skills in a prerequisite graph, across seven strands.
2. **An original problem bank** — every problem written from scratch and tagged into the Atlas.
3. **Distractor-specific explanations** — each wrong answer choice stores the exact
   misconception that produces it, so the feedback is written for _your_ error, not for the
   average error.

It is free, it has no premium tier, practice never requires an account, and there are no
third-party trackers. The users are minors; that is a build constraint, not a legal appendix.

## Independence

**This is an independent project. It is not affiliated with, sponsored by, or endorsed by
Math Kangaroo in USA, NFP.**

No official Math Kangaroo problem appears in this repository — not the text, not a reword,
not the figures. We link to the official free PDFs and publish our own _skill index_ of them:
question number, point value, our skill tags. CI enforces this with a hard size cap on
`content/papers/` as an anti-paste tripwire.

## Running it

Requires Node ≥ 22.18 (the scripts use native TypeScript execution) and pnpm.

```bash
corepack enable pnpm
pnpm install
pnpm dev
```

| Command                 | What it does                                                |
| ----------------------- | ----------------------------------------------------------- |
| `pnpm dev`              | local dev server                                            |
| `pnpm build`            | production build                                            |
| `pnpm lint`             | eslint + prettier check                                     |
| `pnpm typecheck`        | `tsc --noEmit`                                              |
| `pnpm test`             | vitest unit tests                                           |
| `pnpm validate:content` | zod-validate every skill, problem, and paper file           |
| `pnpm derive:unlocks`   | regenerate `unlocks` from `prerequisites`; fails on a cycle |
| `pnpm a11y`             | axe-core against key routes, in both themes                 |

CI runs typecheck → lint → test → validate:content → build on every push and pull request.
All five must pass.

## Repository layout

```
content/    the source of truth — skills, problems, paper indexes, essays (git is the CMS)
docs/       the specs; read docs/README.md first
src/app/    Next.js App Router routes
src/lib/    schemas, content loaders, derived indexes
scripts/    content validation and derivation
```

## Contributing content

Read `docs/03-CONTENT-GUIDE.md` before writing a problem. The rules that matter most:

- Never copy, retype, translate, or closely paraphrase an official problem. If you are
  unsure whether something is too close, it is.
- Every wrong answer choice needs a written misconception. CI fails without one.
- Every figure needs author-written alt text describing what a sighted solver _extracts_.

## License

- **Code** (`src/`, `scripts/`, config): MIT — see `LICENSE`.
- **Content** (`content/`, `docs/`): CC BY-NC-SA 4.0 — see `CONTENT-LICENSE`.
