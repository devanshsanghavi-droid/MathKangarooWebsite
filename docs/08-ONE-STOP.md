# 08 - One place for every math exam

Approved by the owner on 2026-11-20 from a suggestion list ("don't be too hard-lined with
them"): take what fits, skip what does not. Builds on docs/06 and docs/07; their rules stand.
CLAUDE.md non-negotiables stand: original problems only, misconception on every wrong choice,
no account needed to practise, no PII, no trackers, WCAG AA, tokens-only colour.

## 1. Taken

| # | Item | Notes |
|---|---|---|
| 1 | **Exam catalog** `src/lib/exams.ts` | One entry per exam: id, name, short name, colour token, grade range, status (`live` / `soon`), format facts, scoring rule, 3-5 test-day tips, topic-name overrides, related exam, routes (practice, mock, bank, learn). Adding an exam = one entry + tagged questions. |
| 2 | **Coming soon** | AIME (-> AMC 12), MATHCOUNTS (-> AMC 8), PSAT (-> SAT). Listed with a "Coming soon" label and a link to the related live exam. No content. |
| 3 | **Exam pages** `/exams/[id]` | Format, scoring, tips, topics with question counts and (client) the student's accuracy, buttons for Practice / Mock test / Question bank / Learn, and a score chart from sessions. Kangaroo page has a level picker. Soon exams get a short page pointing at the related exam. Existing area homes (`/amc`, `/sat`, `/act`) link to them. |
| 4 | **Exam colours** | One token per exam in tokens.css (`--exam-ka`, `--exam-amc8`, `--exam-amc10`, `--exam-amc12`, `--exam-sat`, `--exam-act`, and a neutral for soon), light + dark, AA-tested in tokens.test.ts. Used on chips, cards, grade-map bars, chart lines. |
| 5 | **Home repositioning** | Headline "Practice for every math exam in one place." Buttons "Start practicing" and "Explore a demo student". Exam shortcut chips. Puzzle of the day answerable on the page. Grade map. Exam catalog cards. 4-step how it works: learn, practice, test, track. Small analytics preview linking to the demo. "More subjects coming" strip. Stay calm and spacious: the owner earlier rejected a cluttered home. Returning students keep their dashboard-first view. |
| 6 | **Grade map** | Grades 1-12 across, one coloured bar per exam over its grades. Choosing a grade (buttons, keyboard, `aria-pressed`) highlights matching exams; an original kangaroo mascot SVG hops to the grade (no motion under `prefers-reduced-motion`). Mobile: horizontal layout that fits 360px without page scroll (vertical list is fine). |
| 7 | **Demo student** | `/progress?demo=1` renders 8 weeks of generated sample activity across a few exams, in memory only, never written to storage or synced, with a clear "Demo data" banner and an exit link. |
| 8 | **Progress upgrades** | Exam filter (all or one). Plain-language summary ("Scores have risen 12 points. Focus next on geometry (52%)."). Key stats: tests taken, average of last 3 tests vs first 3, practice accuracy last 14 days vs the 14 before, questions answered total and this week, practice time and average seconds per question (when timing exists). Charts: mock scores over time (one line per exam, exam colours), weekly accuracy 8 weeks, 12-week activity calendar. Strengths and weak spots table: topic, accuracy, answered, average time, trend, tags "Needs work" (< 60%) and "Strong" (>= 80%), Practice button. Every chart has a text/table alternative. |
| 9 | **Attempt timing** | Attempts gain optional `ms` (time on question, capped at 30 min) and `mode` (`practice` / `test`). Recorded by PracticeSession and the exam engine; merged and validated in progress-sync; older attempts without them still parse. |
| 10 | **Saved questions** | A Save button on each question (local, synced as an optional `saved: string[]` in the progress file, capped at 500, union-merged). Bank status filter gains Saved and Missed; practice can start from "missed" or "saved". |
| 11 | **Practice polish** | Keyboard shortcuts A-E to pick, Enter to check / continue (ignored while typing in a field, announced in a shortcuts hint). One second try after a wrong first pick before the solution is shown (first pick still the one that is recorded). Keyword search in the question banks. |
| 12 | **Footer** | Names every trademark owner once, site-wide: Math Kangaroo in USA, NFP; MAA (AMC); College Board (SAT, PSAT); ACT Education Corp. (ACT); MATHCOUNTS Foundation. Area-specific notices may stay. |
| 13 | **Mobile tab bar** | Home, Practice, Bank, Tests, Progress (Learn reachable from Practice and exam pages). Must fit 360px. |

## 2. Skipped for now, and why

- **Stars, streaks** - gamification pressure on minors; the spec avoids it. Revisit if the owner asks.
- **Nickname / avatar / grade profiles and "Who's practicing?"** - worth doing as local-only profiles later; it changes the progress file shape for everyone, so it gets its own pass.
- **Video lessons / YouTube links** - YouTube sets third-party cookies; not on a site for minors without a privacy-friendly host.
- **"Same idea, new numbers" templates** - valuable, but every generated wrong choice still needs a computed misconception; needs a template schema and its own validator.
- **Typed answers** (SAT grid-in, AIME) - needs a new answer type; comes with AIME.
- **Fredoka / Lexend fonts, green buttons** - the owner chose the OnePrep sky-blue look on 2026-11-17; keep it.
- **Splitting Kangaroo level 1-2 into levels 1 and 2** - needs every 1-2 problem re-tagged; separate content pass.
- **Learn lessons for SAT / ACT** - content-heavy; the Atlas (Kangaroo) and formula sheets (AMC) serve as Learn for now.
- **10-question mini mocks** - full mocks and 10-question section tests already exist.
