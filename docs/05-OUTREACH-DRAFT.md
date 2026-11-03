# 05 - Outreach draft

*Not sent. M0.4 asks for this to be written, not necessarily sent - writing it forces you to be
able to describe the project in a way that survives contact with the organisation whose
trademark you are using.*

Send it when the site is live and has been in front of real students, not before. A note that
says "I built this" is worth more than one that says "I am planning to build this."

---

## Note to Math Kangaroo in USA, NFP

**Subject:** An independent, free skill index for Math Kangaroo preparation

Hello,

My name is Devansh Sanghavi. I tutor Math Kangaroo - about sixty students a year - and I have
built a free, open, non-commercial site to support that work. I am writing because it uses your
competition's name descriptively, and I would rather tell you about it directly than have you
find it.

**What it is.** I broke the contest down into roughly ninety named skills arranged in a
prerequisite graph, and I have been writing original problems tagged into that map. When a
student picks a wrong answer, the site shows the specific misconception that produces that
answer rather than a generic solution. It is free, there is no premium tier, practice does not
require an account, and there is no advertising.

**What it is not.** It is not affiliated with, sponsored by, or endorsed by Math Kangaroo in
USA, NFP, and every page says so in the footer. I understand that "Math Kangaroo" is your
trademark and I use it only descriptively, to say what the material prepares students for.

**On your papers.** No official Math Kangaroo problem appears anywhere on the site or in its
public repository - not the text, not a reworded version, and not the figures. Every problem is
written from scratch by a named author. Where I refer to a past paper, I publish only my own
analysis of it: a question number, a point value, and the skills I think that question tests.
Those files are capped in size by an automated check specifically to make it impossible for
anyone, including me, to quietly start pasting your questions in later. Where a paper is
published free on your site, I link to your PDF rather than hosting a copy.

**What I would welcome.** If anything about how I use the name is not acceptable to you, tell me
and I will change it. If you would find a skill breakdown of your own papers useful, or would
like to look at how the taxonomy is built, I would be glad to share it.

The site is at [URL] and everything, including every problem, is public at [repository URL].

Thank you for running the competition. It is the reason a lot of the students I teach discovered
they like this.

Devansh Sanghavi
[email]

---

## If they object

The realistic outcomes, and what each one means:

| They say | What changes |
|---|---|
| Nothing | Nothing. Keep the disclaimer prominent. |
| "Do not use our name in your site name" | The public name is already **Kangaroo Atlas**, not "Math Kangaroo *anything*". Descriptive use in body copy ("preparation for Math Kangaroo") stays, and is the strongest position anyway. |
| "Stop linking to our PDFs" | Remove the `officialPdfUrl` links; the skill index stands on its own without them. One schema change. |
| "Take down your analysis of our papers" | This is our own writing about a public work and there is a strong argument it is ours to publish. Still: it is a small part of the site, and the Atlas and the problem bank do not depend on it. Do not let it become the hill. |

## Naming, locked

The public name is **Kangaroo Atlas**. It is defined once, in `src/lib/site.ts`, and every
surface reads it from there - the wordmark, page titles, the manifest, the OG cards and the
content licence. Changing it is a one-line change in one file.

It deliberately does not contain "Math Kangaroo": the name is ours, and the relationship to the
competition is stated in prose where it belongs.
