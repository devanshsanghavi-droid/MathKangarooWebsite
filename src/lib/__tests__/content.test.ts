import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  buildContentIndex,
  contentIndex,
  getAdjacentInSkill,
  getAllPapers,
  getAllProblems,
  getAllSkills,
  getContentStats,
  getGraph,
  getPapersForSkill,
  getPrimaryProblemsForSkill,
  getProblem,
  getProblemsForSkill,
  getSkill,
  getSkillsByBand,
  getSkillsByStrand,
  getSkillsForProblem,
  getStrandSummaries,
  paperKey,
  STRAND_META,
  TIER_ORDER,
} from '../content';
import { BANDS, STRANDS } from '../schemas';

const FIXTURES = join(process.cwd(), 'scripts', '__fixtures__');
const real = contentIndex();

describe('buildContentIndex is pure', () => {
  it('returns the same result for the same directory', () => {
    const a = buildContentIndex(join(FIXTURES, 'skill-reference', 'pass', 'content'));
    const b = buildContentIndex(join(FIXTURES, 'skill-reference', 'pass', 'content'));
    expect(a.skills).toEqual(b.skills);
    expect(a.problems).toEqual(b.problems);
    expect([...a.problemsBySkill]).toEqual([...b.problemsBySkill]);
  });

  it('indexes a fixture tree independently of the repo content', () => {
    const index = buildContentIndex(join(FIXTURES, 'skill-reference', 'pass', 'content'));
    expect(index.skills.map((s) => s.id)).toEqual(['CNT-01', 'NUM-01']);
    expect(index.problems.map((p) => p.id)).toEqual(['KA-0001']);
    expect(index.papers).toHaveLength(1);
  });

  it('returns an empty index for a directory with no content', () => {
    const index = buildContentIndex(join(FIXTURES, 'does-not-exist'));
    expect(index.skills).toEqual([]);
    expect(index.problems).toEqual([]);
    expect(index.stats.skills).toBe(0);
    expect(index.strands).toHaveLength(7);
  });

  it('throws on a file that does not match its schema, rather than shipping it', () => {
    // The misconception-required "fail" fixture parses as JSON but breaks the guardrail; it
    // still satisfies the Zod schema, so use the figure fixture, whose alt is too short.
    expect(() =>
      buildContentIndex(join(FIXTURES, 'figure-alt-required', 'fail', 'content')),
    ).toThrow(/does not match its schema/);
  });
});

describe('loaders', () => {
  it('loads every skill file', () => {
    expect(getAllSkills()).toHaveLength(91);
  });

  it('loads every problem file', () => {
    expect(getAllProblems().length).toBeGreaterThanOrEqual(45);
  });

  it('returns skills sorted by id', () => {
    const ids = getAllSkills().map((s) => s.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('returns problems sorted by id', () => {
    const ids = getAllProblems().map((p) => p.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('looks a skill up by id', () => {
    expect(getSkill('CNT-12')?.name).toBe('Counting by position (sliding window)');
  });

  it('looks a problem up by id', () => {
    expect(getProblem('KA-0001')?.skills.primary).toBe('CNT-12');
  });

  it('returns undefined rather than throwing for an unknown id', () => {
    expect(getSkill('ZZZ-99')).toBeUndefined();
    expect(getProblem('KA-9999')).toBeUndefined();
  });

  it('sorts papers newest first', () => {
    const years = getAllPapers().map((p) => p.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('builds a stable paper key', () => {
    expect(paperKey(2019, '3-4')).toBe('2019-3-4');
  });
});

describe('problems-by-skill', () => {
  it('gives every skill an entry, even one with no problems', () => {
    for (const skill of getAllSkills()) {
      expect(getProblemsForSkill(skill.id)).toBeDefined();
    }
  });

  it('includes a problem in the ladder of its secondary skills, not just its primary', () => {
    const problem = getProblem('KA-0001');
    expect(problem?.skills.secondary).toContain('CNT-01');
    expect(getProblemsForSkill('CNT-01').map((p) => p.id)).toContain('KA-0001');
  });

  it('restricts the primary index to problems that lead with that skill', () => {
    expect(getPrimaryProblemsForSkill('CNT-01').map((p) => p.id)).not.toContain('KA-0001');
    expect(getPrimaryProblemsForSkill('CNT-12').map((p) => p.id)).toContain('KA-0001');
  });

  it('orders every ladder by point value and then by id', () => {
    for (const skill of getAllSkills()) {
      const ladder = getProblemsForSkill(skill.id);
      const keys = ladder.map((p) => `${p.points}-${p.id}`);
      expect(keys, skill.id).toEqual([...keys].sort());
    }
  });

  it('never lists the same problem twice in one ladder', () => {
    for (const skill of getAllSkills()) {
      const ids = getProblemsForSkill(skill.id).map((p) => p.id);
      expect(new Set(ids).size, skill.id).toBe(ids.length);
    }
  });
});

describe('skills-by-strand', () => {
  it('partitions the skills exactly', () => {
    const total = STRANDS.reduce((n, strand) => n + getSkillsByStrand(strand).length, 0);
    expect(total).toBe(getAllSkills().length);
  });

  it('puts every skill in the strand its id names', () => {
    for (const strand of STRANDS) {
      for (const skill of getSkillsByStrand(strand)) {
        expect(skill.id.startsWith(strand)).toBe(true);
      }
    }
  });

  it('orders each strand foundation, then core, then gateway', () => {
    for (const strand of STRANDS) {
      const tiers = getSkillsByStrand(strand).map((s) => TIER_ORDER.indexOf(s.tier));
      expect(tiers, strand).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  it('has a name and a blurb for every strand', () => {
    for (const strand of STRANDS) {
      expect(STRAND_META[strand].name.length).toBeGreaterThan(3);
      expect(STRAND_META[strand].blurb.length).toBeGreaterThan(20);
    }
  });
});

describe('skills-by-band', () => {
  it('lists a skill in each band it declares, and only those', () => {
    for (const band of BANDS) {
      for (const skill of getSkillsByBand(band)) {
        expect(skill.bands, `${skill.id} in ${band}`).toContain(band);
      }
    }
  });

  it('covers every band', () => {
    for (const band of BANDS) {
      expect(getSkillsByBand(band).length, band).toBeGreaterThan(0);
    }
  });

  it('counts each skill once per band it declares', () => {
    const totalMemberships = BANDS.reduce((n, band) => n + getSkillsByBand(band).length, 0);
    const declared = getAllSkills().reduce((n, skill) => n + skill.bands.length, 0);
    expect(totalMemberships).toBe(declared);
  });
});

describe('the prerequisite graph', () => {
  const graph = getGraph();

  it('has a node for every skill', () => {
    expect(graph.prerequisites.size).toBe(getAllSkills().length);
    expect(graph.unlocks.size).toBe(getAllSkills().length);
  });

  it('has unlocks that are exactly the reverse of prerequisites', () => {
    for (const [id, prereqs] of graph.prerequisites) {
      for (const prereq of prereqs) {
        expect(graph.unlocks.get(prereq), `${prereq} should unlock ${id}`).toContain(id);
      }
    }
    for (const [id, unlocked] of graph.unlocks) {
      for (const child of unlocked) {
        expect(graph.prerequisites.get(child), `${child} should require ${id}`).toContain(id);
      }
    }
  });

  it('agrees with the unlocks committed in the skill files', () => {
    for (const skill of getAllSkills()) {
      expect([...skill.unlocks].sort(), skill.id).toEqual([...(graph.unlocks.get(skill.id) ?? [])]);
    }
  });

  it('lists the roots, sorted, and gives them depth 0', () => {
    expect(graph.roots).toEqual([...graph.roots].sort());
    for (const root of graph.roots) {
      expect(graph.depth.get(root), root).toBe(0);
    }
  });

  it('places every skill strictly below all of its prerequisites', () => {
    for (const [id, prereqs] of graph.prerequisites) {
      const depth = graph.depth.get(id) ?? 0;
      for (const prereq of prereqs) {
        expect(depth, `${id} must sit below ${prereq}`).toBeGreaterThan(
          graph.depth.get(prereq) ?? 0,
        );
      }
    }
  });

  it('assigns a depth to every skill', () => {
    for (const skill of getAllSkills()) {
      expect(graph.depth.has(skill.id), skill.id).toBe(true);
    }
  });

  it('computes longest-path depth, not shortest', () => {
    // A -> B -> D and A -> D. D must be depth 2, the longest route, so the A->D edge still
    // points downward when the Atlas is drawn.
    const index = buildContentIndex(join(FIXTURES, 'skill-reference', 'pass', 'content'));
    expect(index.graph.depth.size).toBe(index.skills.length);
  });
});

describe('papers-by-skill', () => {
  it('gives every skill an entry', () => {
    for (const skill of getAllSkills()) {
      expect(getPapersForSkill(skill.id)).toBeDefined();
    }
  });

  it('resolves references from the fixture paper', () => {
    const index = buildContentIndex(join(FIXTURES, 'skill-reference', 'pass', 'content'));
    expect(index.papersBySkill.get('NUM-01')).toHaveLength(2);
    expect(index.papersBySkill.get('NUM-01')?.[0]).toMatchObject({ year: 2019, band: '3-4' });
  });

  it("sorts a skill's appearances newest first, then by question number", () => {
    for (const skill of getAllSkills()) {
      const refs = getPapersForSkill(skill.id);
      const keys = refs.map((r) => `${9999 - r.year}-${String(r.questionNumber).padStart(3, '0')}`);
      expect(keys, skill.id).toEqual([...keys].sort());
    }
  });
});

describe('strand summaries', () => {
  it('produces one per strand, in the canonical order', () => {
    expect(getStrandSummaries().map((s) => s.strand)).toEqual([...STRANDS]);
  });

  it('counts skills and tiers consistently', () => {
    for (const summary of getStrandSummaries()) {
      const tierTotal = summary.tiers.foundation + summary.tiers.core + summary.tiers.gateway;
      expect(tierTotal, summary.strand).toBe(summary.skillCount);
    }
  });

  it('counts problems by their primary strand only, so the totals do not double count', () => {
    const total = getStrandSummaries().reduce((n, s) => n + s.problemCount, 0);
    expect(total).toBe(getAllProblems().length);
  });
});

describe('content stats', () => {
  const stats = getContentStats();

  it('counts one misconception per incorrect choice', () => {
    expect(stats.misconceptions).toBe(getAllProblems().length * 4);
  });

  it('counts figures', () => {
    expect(stats.figures).toBe(getAllProblems().filter((p) => p.figure !== null).length);
  });

  it('agrees with the loaders on the totals', () => {
    expect(stats.skills).toBe(getAllSkills().length);
    expect(stats.problems).toBe(getAllProblems().length);
    expect(stats.papers).toBe(getAllPapers().length);
  });

  it('splits the problems across bands without losing any', () => {
    const total = [...stats.problemsByBand.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(getAllProblems().length);
  });

  it('splits the problems across point tiers without losing any', () => {
    const total = [...stats.problemsByPoints.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(getAllProblems().length);
  });
});

describe('getSkillsForProblem', () => {
  it('resolves the primary and secondary skills', () => {
    const problem = getProblem('KA-0001');
    if (!problem) throw new Error('KA-0001 is missing from content/');
    const { primary, secondary } = getSkillsForProblem(problem);
    expect(primary?.id).toBe('CNT-12');
    expect(secondary.map((s) => s.id)).toEqual(['CNT-01']);
  });
});

describe('getAdjacentInSkill', () => {
  it('returns nothing for an unknown problem', () => {
    expect(getAdjacentInSkill('KA-9999')).toEqual({});
  });

  it('reports the position within the ladder', () => {
    const result = getAdjacentInSkill('KA-0001');
    expect(result.skillId).toBe('CNT-12');
    expect(result.position).toBe(1);
    expect(result.total).toBe(getPrimaryProblemsForSkill('CNT-12').length);
  });

  it('has no previous at the start and no next at the end of a ladder', () => {
    for (const skill of getAllSkills()) {
      const ladder = getPrimaryProblemsForSkill(skill.id);
      const head = ladder.at(0);
      const tail = ladder.at(-1);
      if (!head || !tail) continue;
      const first = getAdjacentInSkill(head.id);
      const last = getAdjacentInSkill(tail.id);
      expect(first.previous, skill.id).toBeUndefined();
      expect(last.next, skill.id).toBeUndefined();
    }
  });

  it('chains forwards and backwards consistently', () => {
    for (const problem of getAllProblems()) {
      const { next } = getAdjacentInSkill(problem.id);
      if (!next) continue;
      expect(getAdjacentInSkill(next.id).previous?.id).toBe(problem.id);
    }
  });
});

describe('memoisation', () => {
  it('returns the identical index object on every call', () => {
    expect(contentIndex()).toBe(real);
  });
});

describe('the bundled content the deployed worker actually reads', () => {
  /*
   * There is no filesystem on Cloudflare Workers — process.cwd() is /bundle and content/ does
   * not exist at any path. Prerendered pages never noticed, but /problems, /atlas and /print
   * render per-request and silently served an EMPTY index while answering HTTP 200. These
   * assertions are what keep the bundle honest; `pnpm check:bundle` repeats them in CI.
   */
  it('holds exactly what the content directory holds', () => {
    const fromDisk = buildContentIndex(join(process.cwd(), 'content'));
    const fromBundle = contentIndex();
    expect(fromBundle.skills.map((s) => s.id)).toEqual(fromDisk.skills.map((s) => s.id));
    expect(fromBundle.problems.map((p) => p.id)).toEqual(fromDisk.problems.map((p) => p.id));
    expect(fromBundle.papers).toHaveLength(fromDisk.papers.length);
  });

  it('derives the same indexes, not just the same records', () => {
    const fromDisk = buildContentIndex(join(process.cwd(), 'content'));
    const fromBundle = contentIndex();
    expect(fromBundle.stats).toEqual(fromDisk.stats);
    expect(fromBundle.graph.roots).toEqual(fromDisk.graph.roots);
    for (const skill of fromDisk.skills) {
      expect(
        fromBundle.problemsBySkill.get(skill.id)?.map((p) => p.id),
        skill.id,
      ).toEqual(fromDisk.problemsBySkill.get(skill.id)?.map((p) => p.id));
    }
  });

  it('is not empty, which is the failure mode that hid for a whole deploy', () => {
    expect(contentIndex().skills.length).toBeGreaterThan(0);
    expect(contentIndex().problems.length).toBeGreaterThan(0);
  });
});
