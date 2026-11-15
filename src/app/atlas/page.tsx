import type { Metadata } from 'next';
import { getAllSkills, getContentStats, getProblemsForSkill } from '@/lib/content';
import { POINT_VALUES } from '@/lib/schemas';
import type { AtlasSkill } from '@/lib/atlas-data';
import { AtlasExplorer } from '@/components/atlas/AtlasExplorer';
import { PageContainer, PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'The Skill Atlas',
  description:
    'Every skill Math Kangaroo tests, in a prerequisite graph. Seven strands, 91 skills, ' +
    'foundation through to the 5-point gateways. Browse it as a diagram or as a list.',
  alternates: { canonical: '/atlas' },
};

export const dynamic = 'force-static';

/**
 * The map. `docs/00-SPEC.md` §1.2 calls it the single most important page on the site.
 *
 * One static page (docs/06-V3-REDESIGN.md §3). It used to read `searchParams` on the server, so
 * every filter combination was a fresh render on the worker, and crawlers following the filter
 * links found hundreds of thousands of them. Now the skills are trimmed to what the graph, the
 * list and the panel read, handed to <AtlasExplorer> once, and filtered in the browser.
 */
export default function AtlasPage() {
  const skills: AtlasSkill[] = getAllSkills().map((skill) => {
    const problems = getProblemsForSkill(skill.id);
    return {
      id: skill.id,
      name: skill.name,
      strand: skill.strand,
      tier: skill.tier,
      definition: skill.definition,
      prerequisites: [...skill.prerequisites],
      unlocks: [...skill.unlocks],
      bands: [...skill.bands],
      problemCount: problems.length,
      pointTiers: POINT_VALUES.filter((points) => problems.some((p) => p.points === points)),
    };
  });
  const stats = getContentStats();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Skill Atlas"
        title="The Skill Atlas"
        description={
          <>
            Every skill Math Kangaroo tests, arranged so that each one sits below what it needs
            first. {stats.skills} skills across seven strands. Follow a line downward and you are
            following what a student can learn next.
          </>
        }
      />
      <AtlasExplorer skills={skills} />
    </PageContainer>
  );
}
