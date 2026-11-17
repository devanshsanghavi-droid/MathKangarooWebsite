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
import { PageContainer } from '@/components/ui';
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
        stats={{
          problems: stats.problems,
          skills: stats.skills,
          misconceptions: stats.misconceptions,
        }}
      />
    </PageContainer>
  );
}
