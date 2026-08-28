import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateContent, findCycle, deriveUnlocks } from '../lib/content-rules.ts';
import { STRANDS, type Strand } from '../../src/lib/schemas.ts';

/**
 * The taxonomy is specified in docs/03-CONTENT-GUIDE.md Part A, and the JSON files are the
 * implementation of it. This suite reads the document and asserts the files agree, so the
 * two cannot drift: rename a skill in the guide without touching the file and CI says so.
 */

const guide = readFileSync(join(process.cwd(), 'docs', '03-CONTENT-GUIDE.md'), 'utf8');

const TIER_LETTER: Record<string, string> = {
  F: 'foundation',
  C: 'core',
  G: 'gateway',
};

const specified = [
  ...guide.matchAll(
    /^\|\s*((?:NUM|CNT|GEO|LOG|PAT|MOD|CFT)-\d{2})\s*\|\s*(.+?)\s*\|\s*([FCG])\s*\|/gm,
  ),
].map((m) => ({ id: m[1] ?? '', name: m[2] ?? '', tier: TIER_LETTER[m[3] ?? ''] ?? '' }));

const { bundle, findings } = validateContent({
  contentDir: join(process.cwd(), 'content'),
  figuresDir: join(process.cwd(), 'src', 'components', 'figures'),
});

/** Counts from the strand headings in Part A, e.g. "### NUM — Number & Arithmetic (15)". */
const EXPECTED_PER_STRAND: Record<Strand, number> = {
  NUM: 15,
  CNT: 18,
  GEO: 18,
  LOG: 11,
  PAT: 7,
  MOD: 10,
  CFT: 12,
};

describe('the Skill Atlas', () => {
  it('reads 91 skills out of the content guide', () => {
    expect(specified).toHaveLength(91);
  });

  it('has one JSON file for every skill the guide specifies, and no extras', () => {
    const onDisk = [...bundle.skills.keys()].sort();
    const inGuide = specified.map((s) => s.id).sort();
    expect(onDisk).toEqual(inGuide);
  });

  it.each(specified)('$id matches the guide on name and tier', ({ id, name, tier }) => {
    const skill = bundle.skills.get(id);
    expect(skill, `${id} has no file`).toBeDefined();
    expect(skill?.name).toBe(name);
    expect(skill?.tier).toBe(tier);
  });

  it.each(STRANDS)('%s holds the number of skills the guide says it does', (strand) => {
    const count = [...bundle.skills.values()].filter((s) => s.strand === strand).length;
    expect(count).toBe(EXPECTED_PER_STRAND[strand]);
  });

  it('passes every content rule', () => {
    expect(findings.map((f) => `${f.rule} @ ${f.file}: ${f.message}`)).toEqual([]);
  });
});

describe('the prerequisite graph', () => {
  const prerequisites = new Map(
    [...bundle.skills.values()].map((s) => [s.id, s.prerequisites] as const),
  );

  it('is acyclic', () => {
    expect(findCycle(prerequisites)).toBeNull();
  });

  it('has every prerequisite resolving to a real skill', () => {
    for (const [id, prereqs] of prerequisites) {
      for (const prereq of prereqs) {
        expect(bundle.skills.has(prereq), `${id} -> ${prereq}`).toBe(true);
      }
    }
  });

  it('has unlocks exactly derived from prerequisites', () => {
    const derived = deriveUnlocks(prerequisites);
    for (const skill of bundle.skills.values()) {
      expect([...skill.unlocks].sort(), skill.id).toEqual(derived.get(skill.id));
    }
  });

  it('gives every foundation skill an empty or foundation-only prerequisite list', () => {
    // A foundation skill that depends on a gateway skill is a tiering mistake, not a graph one.
    for (const skill of bundle.skills.values()) {
      if (skill.tier !== 'foundation') continue;
      for (const prereq of skill.prerequisites) {
        expect(bundle.skills.get(prereq)?.tier, `${skill.id} -> ${prereq}`).toBe('foundation');
      }
    }
  });

  it('has no isolated node — every skill either needs something or is needed by something', () => {
    // A root with unlocks is fine: some ideas genuinely start the graph. A node with neither
    // is a skill nobody can reach and nothing leads out of, which is a taxonomy bug.
    const isolated = [...bundle.skills.values()]
      .filter((s) => s.prerequisites.length === 0 && s.unlocks.length === 0)
      .map((s) => s.id);
    expect(isolated).toEqual([]);
  });

  it('has a small, deliberate set of roots', () => {
    const roots = [...bundle.skills.values()]
      .filter((s) => s.prerequisites.length === 0)
      .map((s) => s.id);
    // Conservative edges are the goal, so roots are expected — but a graph that is mostly
    // roots is a graph nobody drew. Fail if fewer than two thirds of skills have a parent.
    expect(roots.length).toBeLessThan(bundle.skills.size / 3);
  });

  it('has at least one skill in every band', () => {
    for (const band of ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12']) {
      const count = [...bundle.skills.values()].filter((s) =>
        s.bands.includes(band as never),
      ).length;
      expect(count, `band ${band}`).toBeGreaterThan(0);
    }
  });
});

describe('every skill is written, not stubbed', () => {
  it.each([...bundle.skills.values()].map((s) => [s.id, s] as const))(
    '%s has a real definition, triggers and misconceptions',
    (_id, skill) => {
      expect(skill.definition.length).toBeGreaterThanOrEqual(80);
      expect(skill.recognizeWhen.length).toBeGreaterThanOrEqual(3);
      expect(skill.misconceptions.length).toBeGreaterThanOrEqual(2);
      // Misconceptions are written in the student's own voice: "I counted..." not "Students count...".
      const firstPerson = skill.misconceptions.filter((m) => /^I\b/.test(m.trim()));
      expect(firstPerson.length, `${skill.id} misconceptions must be in first person`).toBe(
        skill.misconceptions.length,
      );
    },
  );
});
