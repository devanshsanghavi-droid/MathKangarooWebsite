# What this website is - my own explainer

*Private notes. This is for me, so I can explain the project clearly to a teacher, a parent,
a counselor, an interviewer, or a friend who asks "what have you been building?" - without
rambling or undershooting it.*

---

## The ten-second version

> "It's a free website for Math Kangaroo prep. Instead of organizing everything by past exam
> year like everyone else does, I mapped out the ~90 actual skills the test covers and built a
> problem bank on top of that map - so when a kid gets something wrong, the site can tell them
> which specific skill is missing, not just that they got it wrong."

## The thirty-second version

> "I tutor about 60 kids a year for Math Kangaroo. The problem with every free resource out
> there is that it's organized by year - you do the 2019 test, you get a score, and you learn
> nothing about *why* you missed what you missed.
>
> So I built the thing I actually needed. I broke the contest down into about 90 named skills
> arranged in a prerequisite graph, and I've been writing original problems tagged into that
> map. The part I'm proudest of: every wrong answer choice stores the specific mistake that
> produces it. So if you pick C, you don't get a generic solution - you get 'you counted the
> 2×2 squares as four instead of nine because you split the board into quadrants instead of
> sliding the window.'
>
> It's free, it's open source, and my own students use it every week."

## The two-minute version, if they're actually interested

Start with the frustration, because that's the honest origin:

I've been tutoring Math Kangaroo for a few years - roughly 60 students annually - and I kept
running into the same wall. A kid does a practice test, scores 68 out of 120, and neither of us
learns anything actionable. "Study more" isn't a diagnosis. I was doing the diagnosis in my
head, every session, for every kid, and it wasn't scaling past the people sitting in front of me.

So the site is that diagnosis, made into software.

**The Skill Atlas** is the spine. About 90 atomic skills - things like *counting by position*,
*nets and folding*, *complementary counting*, *invariants* - grouped into seven strands and
connected by prerequisite arrows. You can see it as a map. Each skill has its own page with a
plain-language definition, the phrases that tell you it's showing up in a problem, a worked
example, the misconceptions students actually have, and a ladder of practice problems at the
3-, 4-, and 5-point difficulties the real exam uses.

**The problem bank** is entirely original. This part matters and it's worth saying out loud:
Math Kangaroo's past papers are copyrighted, so I don't host them. I link to their official free
PDFs and publish my own *skill index* of them - "2019, level 5–6, question 22 tests these two
skills." Everything else on the site is a problem I wrote. That's the constraint that made the
project real work rather than a link farm.

**The explanations** are the thing I haven't seen anywhere else. Writing a problem is easy; the
hard part is writing five answer choices where each wrong one comes from a real mistake a real
kid makes. I store that mistake alongside the choice. So the feedback is written for *your*
error. There's also a three-step hint ladder - a nudge, then a strategy, then the full solution - and where they differ, two solutions: the elegant one and the reliable-under-time-pressure one.

**The practice modes** each exist because a different thing goes wrong in March. A diagnostic
that gives you a map instead of a number. A daily spaced-repetition drill. A full 75-minute mock
exam that scores exactly like the real one and shows you where your time bled out. An error
journal. And a *triage trainer* - three minutes, twelve problems, and the only decision you make
is "solve now / come back / guess." That's the highest-leverage skill on a timed contest and I've
never seen anyone teach it deliberately.

**The mentor side** is why it isn't just a portfolio piece. I run my actual program on it. I can
assign a set to Saturday's group, and I get a heatmap of the skill map colored by how my whole
cohort is doing - when 18 of 24 students are red on nets-and-folding, that's my lesson plan,
decided by evidence instead of a hunch.

**And it's public about its own results.** There's a dashboard with the numbers - problems
written, students served, pre/post score changes - where every number links to a definition, and
the score-change tile says plainly that there's no control group and the students are
self-selected. I'd rather report something true and limited than something impressive and soft.

---

## The section-by-section tour

Use this if someone is looking at the site with me.

| Page | What to say |
|---|---|
| **Home** | "Try the sample problem - pick a wrong answer on purpose." That one interaction explains the whole project faster than I can. |
| **The Atlas** | "This is the map. Every node is a skill, the arrows are prerequisites. Once you're signed in it colors itself in with what you've mastered." |
| **A skill page** | "Definition, how you recognize it, a worked example, the mistakes people make, and problems at all three point values." |
| **A problem** | "Five choices, and each wrong one knows what mistake it comes from. Three levels of hint. Two solutions where they differ." |
| **Papers** | "I don't host their problems - that's their copyright. I link to the official PDFs and publish my own skill analysis of each one." |
| **Diagnostic** | "Fifteen questions, and instead of a score you get a map of what to fix and a six-week plan." |
| **Mock** | "Exactly the real format - 75 minutes, 30 questions, 3/4/5 points, no penalty for guessing. Afterward it shows where your time went." |
| **Triage trainer** | "Three minutes. You don't solve anything, you just decide what to attack. Nobody teaches this and it's worth a lot of points." |
| **Teach** | "This is my side. Rosters, assignments, and a cohort heatmap that tells me what to teach next." |
| **Impact** | "The numbers, with their caveats attached. The pre/post tile says outright that there's no control group." |
| **Methodology** | "Three essays: how I built the taxonomy, how difficulty gets calibrated from real attempt data, and what version 1 got wrong." |

---

## Questions I should have answers ready for

**"Isn't this just a worksheet site?"**
No - worksheet sites are organized by year and end at an answer key. This is organized by skill
and starts at the diagnosis. The answer key is the least interesting part of it.

**"Where do the problems come from?"**
I write them. Every one. Their past papers are copyrighted so I can't republish them, which
forced the bank to be original - and that turned out to be the best thing about the project.

**"How do you know it works?"**
Partly I don't, and I say so on the site. I have pre/post diagnostic scores for the students who
used it, and they improved. But there's no control group and the kids who stick with it are
self-selected, so the honest claim is "students who used this improved," not "this caused it."
I'd rather be believed than impressive.

**"How much did it cost?"**
Nothing. Next.js on Vercel's free tier, Supabase's free tier for the database, self-hosted
analytics. The only real cost is my time, and most of that goes into writing problems, not code.

**"How long did it take?"**
The code is a couple of months. The content is forever - I write ten new problems a week. That
ratio is the actual story of the project.

**"Why give it away?"**
Because the kids who most need a Kangaroo tutor are exactly the ones who can't get one. Sixty
students a year is my ceiling if I'm the delivery mechanism. A free site with a downloadable
tutor kit doesn't have that ceiling.

**"What's the hardest part?"**
Writing distractors. Coming up with a good problem takes twenty minutes. Coming up with four
wrong answers that each correspond to a real, specific misunderstanding takes an hour, and it's
the only reason the feedback is any good.

---

## Things to say, and things not to say

**Say:** "I wrote 400 problems." Countable, checkable, and the commit history proves it.
**Say:** "Eighteen of twenty-four students were failing this skill, so that became the lesson."
**Say:** "There's no control group, so I can't claim the site caused the improvement."
**Say:** "The copyright constraint is what made it original."

**Don't say:** "It uses AI to personalize learning." It doesn't, and it doesn't need to.
**Don't say:** "It raised scores by 19 points." That's the number, but not the claim.
**Don't say:** "Revolutionary" / "cutting-edge" / "one-stop shop." One inflated sentence makes
every honest one next to it sound like marketing.

---

## The line for an application or a résumé

> Built and maintain the free, open-source platform my Math Kangaroo tutoring program runs on:
> a 90-skill diagnostic map, 400+ original problems I wrote, and per-distractor explanations
> that respond to a student's specific mistake. Used weekly by my own cohorts and openly
> licensed so other tutors can run it themselves.

The reason this beats "tutored 60 students": someone can open the repo and check every word of it.
