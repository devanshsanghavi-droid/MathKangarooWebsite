import type { Band, Points, Skill } from './schemas';
import type { AtlasQuery, RawSearchParams } from './atlas-params';

/**
 * What the Atlas page sends to the browser for each skill: everything the filters, the graph,
 * the list and the side panel read, and nothing else (no misconceptions, no worked examples).
 * Built at build time; the page is static and filters in the browser (docs/06 §3).
 */
export interface AtlasSkill extends Pick<
  Skill,
  'id' | 'name' | 'strand' | 'tier' | 'definition' | 'prerequisites' | 'unlocks'
> {
  bands: Band[];
  problemCount: number;
  /** Point values that at least one of this skill's problems carries. */
  pointTiers: Points[];
}

/**
 * The filter, as one pure function, so the graph and the list cannot disagree about which
 * skills a query shows: both views render exactly this list.
 */
export function filterAtlasSkills(
  skills: readonly AtlasSkill[],
  query: Pick<AtlasQuery, 'strands' | 'band' | 'points' | 'hasProblems'>,
): AtlasSkill[] {
  return skills.filter((skill) => {
    if (query.strands.length > 0 && !query.strands.includes(skill.strand)) return false;
    if (query.band && !skill.bands.includes(query.band)) return false;
    if (query.hasProblems && skill.problemCount === 0) return false;
    if (query.points !== null && !skill.pointTiers.includes(query.points)) return false;
    return true;
  });
}

/** URLSearchParams to the shape `parseAtlasQuery` accepts (repeated keys become arrays). */
export function searchToRaw(search: string): RawSearchParams {
  const params = new URLSearchParams(search);
  const raw: RawSearchParams = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length === 1 ? all[0] : all;
  }
  return raw;
}
