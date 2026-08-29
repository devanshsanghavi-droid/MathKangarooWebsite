# 05 — Design Direction v2

**Supersedes §0.1 of `docs/00-SPEC.md`.** Where this file and `00-SPEC.md` disagree about
colour, type, shape, or the structure of `/skill/[id]`, this file wins.

Two changes: a palette built around a single reserved-colour rule, and a Khan-Academy-style
unit structure that turns a skill page from a document into something you work through.

---

## 1. The problem with v1

v1 coloured the 3-, 4-, and 5-point tiers green / amber / rose. That means a student sees red
on the hardest problems before reading a word of them — and red already means *wrong*
everywhere else on the site. The problems we most need them to attempt are pre-labelled as
failure. It also fails in greyscale, which is how every printed worksheet renders.

## 2. The rule the whole palette hangs on

> **Green, red, and amber are reserved.** They appear only in response to something the
> student did: correct, incorrect, hint taken. Never for difficulty, never for a category,
> never for decoration. Everything else is neutral or the single teal accent.

If a component needs a colour and none of the reserved three apply, it uses a neutral or the
accent. There is no fourth option. Add this to `CLAUDE.md`'s non-negotiables.

## 3. Two ramps, both legible without colour

**Difficulty** — a neutral slate ramp plus filled dots. Weight, not alarm.

| Tier | Token | Glyph |
|---|---|---|
| 3 points | `--d1-bg` / `--d1-fg` | `●○○` |
| 4 points | `--d2-bg` / `--d2-fg` | `●●○` |
| 5 points | `--d3-bg` / `--d3-fg` | `●●●` |

**Mastery** — a single teal ramp with a distinct icon per step. Renames the existing state
machine's outputs for display only; `src/lib/mastery.ts` logic is unchanged.

| Display name | Internal state | Token | Icon |
|---|---|---|---|
| Not started | `unseen` | `--m0` | `○` |
| Familiar | `seen` | `--m1` | `◔` |
| Proficient | `shaky` → renamed | `--m2` | `◕` |
| Mastered | `mastered` | `--m3` | `✓` |

Note: `shaky` becomes **Proficient** in the UI only. Keep the internal name — it describes what
the state machine measures. Add a comment in `mastery.ts` pointing at this table.

## 4. `src/styles/tokens.css` — full replacement

```css
:root{
  /* surfaces */
  --ground:#F6F8FA; --surface:#FFFFFF; --surface-2:#EFF2F6; --surface-3:#E4E9F0;
  /* text */
  --ink:#181B21; --ink-2:#4B5563; --ink-3:#767F8C;
  /* rules */
  --rule:#E1E6EC; --rule-strong:#C9D0DA;
  /* accent — the only saturated colour in ordinary use */
  --accent-700:#0B5C66; --accent-600:#0E7C86; --accent-500:#17939E; --accent-100:#DDF0F2;
  /* RESERVED — feedback only */
  --correct-700:#146C43; --correct-600:#1A8A55; --correct-100:#E3F5EA; --correct-border:#96D4B0;
  --wrong-700:#A82820;   --wrong-600:#C4342A;   --wrong-100:#FCE9E7; --wrong-border:#EFAEA8;
  --hint-700:#875200;    --hint-100:#FBF0D9;    --hint-border:#E5C67F;
  /* difficulty ramp */
  --d1-bg:#EDF1F6; --d1-fg:#4B5563;
  --d2-bg:#DCE3ED; --d2-fg:#374151;
  --d3-bg:#C6CFDD; --d3-fg:#1F2937;
  /* mastery ramp */
  --m0:#CDD4DE; --m1:#A5DCE1; --m2:#4CB2BC; --m3:#0E7C86;
  --focus:#0E7C86;
  --shadow:0 1px 2px rgba(24,27,33,.05),0 6px 20px -10px rgba(24,27,33,.16);
  /* type */
  --ui:"Figtree",system-ui,sans-serif;
  --body:"Source Sans 3",system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
}

@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){
  --ground:#12151A; --surface:#191D24; --surface-2:#222730; --surface-3:#2C323C;
  --ink:#E9ECF1; --ink-2:#A9B2BF; --ink-3:#818B99;
  --rule:#2A303A; --rule-strong:#3C434F;
  --accent-700:#7BD7E0; --accent-600:#12909C; --accent-500:#17939E; --accent-100:#10333A;
  --correct-700:#6FD39B; --correct-600:#1A8A55; --correct-100:#122B1F; --correct-border:#2C6B47;
  --wrong-700:#F4A19A;   --wrong-600:#C4342A;   --wrong-100:#2E1817; --wrong-border:#6E312B;
  --hint-700:#E3BC6E;    --hint-100:#2C2313;    --hint-border:#5C4A22;
  --d1-bg:#242A34; --d1-fg:#A9B2BF;
  --d2-bg:#2E3644; --d2-fg:#C3CBD7;
  --d3-bg:#3B4555; --d3-fg:#DDE3EB;
  --m0:#39414D; --m1:#2C6068; --m2:#1B8993; --m3:#3DBECA;
  --focus:#3DBECA;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.7);
}}

:root[data-theme="dark"]{ /* identical block to the media query above */ }
```

The `[data-theme="dark"]` block must be a literal copy of the media-query body, not a reference.
Keep the three-state pattern from `00-SPEC.md` §0.1 — that part was right.

## 5. Type

| Role | Face | Size / leading |
|---|---|---|
| Headings, UI, buttons, labels | Figtree 500–700 | scale below |
| Reading — prose, solutions, explanations | Source Sans 3 400/600 | 17px / 1.65 |
| **Problem statements** | Source Sans 3 400 | **19px / 1.55** |
| Ids, point values, metadata | IBM Plex Mono 400/500 | 12–13px |

Scale: 12 / 13.5 / 15 / 17 / 19 / 22 / 26 / 31 / 44.
Prose max-width 64ch. The serif from v1 is retired — at 17px a humanist sans reads better on
the low-end screens this has to work on.

## 6. Shape and touch

- Radius: 12px on cards and answer choices, 10px on buttons, 20px on pills. Up from v1.
- Answer choices: 2px border, 14px padding, **44px minimum height**.
- Focus: 3px `--focus` ring at 2px offset. Never removed, never subtle.

## 7. Structural changes — the Khan-style part

### 7.1 App shell — add a persistent sidebar
Left rail, ~260px, holding the strand → skill tree with the student's position marked and
mastery dots inline. Collapses to a drawer under 900px. The header keeps the theme toggle,
search, and account. Content column max 720px, centred in the remaining space.

### 7.2 `/skill/[id]` becomes a unit page
Replace the nine stacked sections with:

1. **Breadcrumb** — Strand › Band › Skill
2. **Title + one-line definition** + difficulty pill
3. **Mastery bar** — segmented across the skill's problems, with a legend
4. **Lesson list**, each row an icon + title + progress + action:
   - Learn — definition, recognition cues, worked example, misconceptions
   - Practice — 3-point ladder
   - Practice — 4-point ladder
   - Practice — 5-point ladder
   - Skill quiz — locked until proficient on all three ladders
5. **Prerequisites / unlocks** chips
6. **In official papers** — unchanged

Nothing is deleted; the nine sections' content moves inside "Learn" and the ladders.

### 7.3 Exercise view
One problem at a time, with:
- Streak dots at the top and "3 in a row to finish this ladder"
- Large choice buttons (44px+), keyboard operable
- **Immediate distractor-specific feedback** — keep this. It is the thing Khan doesn't have,
  and the reason the site exists. Do not switch to check-then-reveal.
- Sticky action bar: Show a hint · Skip · Next problem
- Hint panel in the reserved amber; feedback panel in reserved green or red

### 7.4 Atlas
Node fill uses the mastery ramp. Tier (foundation / core / gateway) moves to **border weight**
— 1px / 1.5px / 2.5px — freeing hue entirely for mastery.

### 7.5 Everywhere
Mastery level shown as name + icon + colour, never colour alone.

## 8. What we deliberately do not take from Khan Academy

- **Energy points and badges.** Extrinsic rewards drift away from understanding the maths.
- **The mascot and illustration style.** Theirs, and copying it reads as imitation.
- **Burying the skill map.** Ours is the point; it stays one click away from everywhere.
- **Video-first teaching.** Written, per-distractor explanations are the differentiator.

## 9. Acceptance

- [ ] No component references `--p3`, `--p4`, or `--p5`; those tokens are deleted
- [ ] A repo-wide grep finds no green or red outside feedback components
- [ ] Every difficulty and mastery indicator is legible in greyscale (test: print a worksheet)
- [ ] All text passes WCAG AA at its rendered size, in both themes — check `--ink-3` on `--surface-2`
- [ ] Answer choices are ≥44px tall and keyboard operable
- [ ] `/skill/[id]` renders as a unit page with a working mastery bar for a signed-out visitor
- [ ] Sidebar collapses cleanly at 900px and is reachable by keyboard
- [ ] Full CI green, both themes checked, axe clean

---

## 10. Migration notes — read before starting

### 10.1 The aliasing bug that proves the point
`tokens.css` currently contains:

```css
--correct: var(--p3);      /* green — also means "3 points" */
--incorrect: var(--p5);    /* rose  — also means "5 points" */
```

Feedback colours are not merely *similar* to the difficulty colours — they are literally the
same variables. One colour, two meanings, in the one place on the site where a student is being
told whether they were right. Breaking this alias is the single highest-value change in v2.

### 10.2 Files that reference the retiring tokens
- `src/styles/tokens.css`
- `src/styles/globals.css`
- `src/components/PointPill.tsx` → becomes `DifficultyPill.tsx`
- `src/app/problem/[id]/opengraph-image.tsx`
- `src/lib/__tests__/tokens.test.ts`

### 10.3 Keep the contrast test — extend it
`src/lib/__tests__/tokens.test.ts` and `src/lib/contrast.ts` already fail the build on a
contrast regression. Do not delete or weaken them. Extend the test to cover every new token
pair: `--ink-3` on `--surface-2`, each difficulty `fg` on its `bg`, each mastery step against
`--surface`, and every reserved feedback `700` on its `100`.

### 10.4 Add a new CI rule
Fail the build if `--correct*`, `--wrong*`, or `--hint*` are referenced outside the feedback
components, and if any green or red hex literal appears anywhere in `src/` outside
`tokens.css`. This is the rule from §2, enforced rather than remembered.
