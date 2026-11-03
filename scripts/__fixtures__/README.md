# Content fixtures

One directory per content guardrail. Each holds two complete, tiny `content/` trees:

- `pass/` - valid content. `validateContent()` must return **zero** findings.
- `fail/` - content that breaks exactly the rule the directory is named for.

Both halves matter. A rule with only a failing fixture proves it can fire but not that it
can stay quiet; a rule with only a passing fixture proves the opposite. A guardrail that is
always on is as useless as one that is always off.

| Directory | Guardrail |
|---|---|
| `misconception-required/` | every incorrect choice carries a written misconception |
| `figure-alt-required/` | every figure carries author-written alt text |
| `paper-size-cap/` | no file in `content/papers/` exceeds the anti-paste byte cap |
| `duplicate-ids/` | no problem id and no skill id appears twice |
| `skill-reference/` | no problem or paper index references a skill outside the Atlas |

These files are excluded from Prettier, ESLint, and `tsc` on purpose: they are deliberately
malformed in places and a formatter "fixing" them would silently disarm a test.

The assertions live in `scripts/__tests__/content-rules.test.ts`.
