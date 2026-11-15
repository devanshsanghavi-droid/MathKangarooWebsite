import type { Metadata } from 'next';
import {
  getAllProblems,
  getAllSkills,
  getContentStats,
  getSkill,
  getStrandSummaries,
} from '@/lib/content';
import { dayNumber } from '@/lib/potd';
import { encodeHomeProblem, potdWindow, previewText } from '@/lib/practice-home';
import { ProblemOfTheDay } from '@/components/ProblemOfTheDay';
import { PracticeHome } from '@/components/home/PracticeHome';
import { PageContainer, StatTile } from '@/components/ui';
import { SITE } from '@/lib/site';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = {
  title: {
    absolute: `${SITE.name} - ${SITE.tagline}`,
  },
  description: SITE.description,
  alternates: { canonical: '/' },
};

export const dynamic = 'force-static';

/** How many days of Problem-of-the-day picks the page carries (see ProblemOfTheDay). */
const POTD_DAYS = 60;

/**
 * The Practice home (docs/06-V3-REDESIGN.md §4).
 *
 * Fully static: everything the student-specific parts need (problem ids, levels, strands,
 * primary skills) is worked out here at build time and handed to <PracticeHome>, which reads
 * the progress file in the browser. The counters at the bottom are counted from the content
 * files, so they cannot drift from what the site actually holds.
 */
export default function HomePage() {
  const stats = getContentStats();
  const problems = getAllProblems();
  const skills = getAllSkills();
  const today = dayNumber(new Date());

  const rows = problems.flatMap((problem) => {
    const strand = getSkill(problem.skills.primary)?.strand;
    return strand
      ? [
          encodeHomeProblem({
            id: problem.id,
            band: problem.band,
            points: problem.points,
            strand,
            skill: problem.skills.primary,
          }),
        ]
      : [];
  });

  const picks = potdWindow(problems, today, POTD_DAYS).map((problem) => ({
    id: problem.id,
    points: problem.points,
    band: problem.band,
    statement: previewText(problem.statement),
    skillName: getSkill(problem.skills.primary)?.name ?? null,
  }));

  return (
    <PageContainer>
      <StructuredData />
      <PracticeHome
        problems={rows}
        skills={skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          strand: skill.strand,
          tier: skill.tier,
          bands: [...skill.bands],
        }))}
        strands={getStrandSummaries().map((strand) => ({
          strand: strand.strand,
          name: strand.name,
          skillCount: strand.skillCount,
        }))}
        potd={<ProblemOfTheDay picks={picks} startDay={today} />}
      />

      <section aria-labelledby="counters-heading" className="mt-10">
        <h2 id="counters-heading" className="ui m-0 text-lg font-semibold">
          What is here so far
        </h2>
        <p className="prose-measure mt-1 mb-4 text-sm text-ink-2">
          Counted from the files in the repository at build time, so these numbers cannot drift from
          what the site actually holds.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            value={stats.skills}
            label="Skills mapped"
            detail="Named skills in the Atlas, each with a definition and a prerequisite list."
          />
          <StatTile
            value={stats.problems}
            label="Problems authored"
            detail="Original problems written from scratch. No official problem is reproduced here."
          />
          <StatTile
            value={stats.misconceptions}
            label="Explanations written"
            detail="One per wrong answer choice: the specific mistake that produces that answer."
          />
          <StatTile
            value={stats.figures}
            label="Figures drawn"
            detail="Hand-authored SVG figures, each with author-written alt text."
          />
        </div>
        {/*
          A "students served" counter belongs to the database and to /impact in Phase 3, and it
          must never be published below n = 10. Inventing it here would be exactly the kind of
          unbacked claim /impact exists to avoid.
        */}
        <p className="mt-3 mb-0 text-xs text-ink-3">
          Students-served figures will come from the database, and nothing derived from fewer than
          ten students is published at all.
        </p>
      </section>
    </PageContainer>
  );
}
