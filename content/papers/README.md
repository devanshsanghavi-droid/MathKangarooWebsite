# Paper indexes

One file per official paper: `<year>-<band>.json`.

**These files hold our analysis. They never hold the paper.**

Allowed in a file: `year`, `band`, `officialPdfUrl` (always remote, always mathkangaroo.org),
and for each question a `number`, a `points` value, our `skills` tags, and an optional `note`
of at most 120 characters in our own words.

Never allowed: question text, a reworded question, a figure, an answer, or a distractor.

CI caps **every file in this directory at 2048 bytes**. That is a tripwire, not a performance
limit: an index is a few hundred bytes, so a file that grows is a file someone started pasting
into. Do not raise the cap.

## Writing one

Open the official PDF, read question 1, and ask which Atlas skill a student needs to answer it.
Tag one or two — three means you have not decided. Then question 2. It takes about an hour for
a 24-question paper and it is the single best way to find out where the taxonomy is wrong: any
question you cannot classify is either a missing skill or a badly drawn one, and it belongs in
the backlog rather than being forced into the nearest node.

Run `pnpm validate:content` when you are done. It checks every tag resolves to a real skill.
