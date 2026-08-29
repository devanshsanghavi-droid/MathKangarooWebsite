import 'server-only';
import { getAllSkills, getProblemsForSkill, STRAND_META } from './content';
import { STRANDS } from './schemas';
import type { RailStrand } from '@/components/shell/rail-data';

/**
 * The sidebar's tree, built once at build time from the content files.
 *
 * The rail is a client component, so this is the boundary: everything it needs is flattened
 * here into plain data. Only the four fields it draws are included — a rail that carried whole
 * Skill objects would put 91 definitions and 273 misconceptions into the payload of every page
 * on the site.
 */
export function railStrands(): RailStrand[] {
  const skills = getAllSkills();
  return STRANDS.map((strand) => ({
    strand,
    name: STRAND_META[strand].name,
    skills: skills
      .filter((skill) => skill.strand === strand)
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        tier: skill.tier,
        problemCount: getProblemsForSkill(skill.id).length,
      })),
  }));
}
