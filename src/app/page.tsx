import type { Metadata } from 'next';
import {
  getAllProblems,
  getAllSkills,
  getContentStats,
  getSkill,
  getStrandSummaries,
} from '@/lib/content';
import { dayNumber } from '@/lib/potd';
import { encodeHomeProblem, potdWindow } from '@/lib/practice-home';
import { kaPracticeItem } from '@/lib/practice-item';
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

/**
 * How many days of puzzle-of-the-day picks the page carries (see InlinePotd). Each pick is a
 * whole practice item (choices, misconceptions, hints, solution) so it can be answered on the
 * page, about 2 KB each; two weeks keeps that small. The site redeploys far more often than
 * that, and if it ever does not, the window simply repeats: still one stable puzzle per day.
 */
const POTD_DAYS = 14;

/**
 * The home page (docs/06-V3-REDESIGN.md §4, repositioned for every exam by docs/08 item 5).
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

  // Problems with a figure are left out of the daily pool: drawing one on the home page would
  // ship the whole figure registry to every visitor. They are 3% of the bank, all still in
  // practice and the question bank.
  const skillName = (id: string): string | undefined => getSkill(id)?.name;
  const picks = potdWindow(
    problems.filter((problem) => problem.figure === null),
    today,
    POTD_DAYS,
  ).map((problem) => ({
    item: kaPracticeItem(problem, skillName),
    skillName: skillName(problem.skills.primary) ?? null,
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
        potd={picks}
        potdStartDay={today}
        stats={{
          problems: stats.problems,
          skills: stats.skills,
          misconceptions: stats.misconceptions,
        }}
      />
    </PageContainer>
  );
}
