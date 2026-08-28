import { describe, it, expect } from 'vitest';
import { computeLayers, layoutAtlas, tierBands, LAYOUT_CONSTANTS } from '../atlas-layout';
import { getAllSkills, getGraph, getProblemsForSkill } from '../content';
import { STRANDS, type Skill } from '../schemas';

const skills = getAllSkills();
const problemCounts = new Map(skills.map((s) => [s.id, getProblemsForSkill(s.id).length]));
const layout = layoutAtlas(skills, problemCounts);

function fakeSkill(partial: Partial<Skill> & Pick<Skill, 'id'>): Skill {
  return {
    name: 'Fixture skill',
    strand: 'NUM',
    tier: 'core',
    bands: ['3-4'],
    definition: 'x'.repeat(90),
    recognizeWhen: ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'],
    canonicalProblem: null,
    misconceptions: ['I did the wrong thing.', 'I did another wrong thing.'],
    prerequisites: [],
    unlocks: [],
    ...partial,
  } as Skill;
}

describe('computeLayers', () => {
  it('puts a foundation skill with no prerequisites on row 0', () => {
    const layers = computeLayers([fakeSkill({ id: 'NUM-01', tier: 'foundation' })]);
    expect(layers.get('NUM-01')).toBe(0);
  });

  it('floors core at row 1 and gateway at row 2, so the tiers read as bands', () => {
    const layers = computeLayers([
      fakeSkill({ id: 'NUM-01', tier: 'core' }),
      fakeSkill({ id: 'NUM-02', tier: 'gateway' }),
    ]);
    expect(layers.get('NUM-01')).toBe(1);
    expect(layers.get('NUM-02')).toBe(2);
  });

  it('pushes a skill below its prerequisites even when the tier says otherwise', () => {
    // A foundation skill that depends on a gateway skill would be a tiering mistake, but the
    // layout must not draw an upward arrow because of it.
    const layers = computeLayers([
      fakeSkill({ id: 'NUM-01', tier: 'gateway' }),
      fakeSkill({ id: 'NUM-02', tier: 'foundation', prerequisites: ['NUM-01'] }),
    ]);
    expect(layers.get('NUM-02')).toBeGreaterThan(layers.get('NUM-01') ?? 0);
  });

  it('uses the longest path, not the shortest', () => {
    const layers = computeLayers([
      fakeSkill({ id: 'NUM-01', tier: 'foundation' }),
      fakeSkill({ id: 'NUM-02', tier: 'foundation', prerequisites: ['NUM-01'] }),
      fakeSkill({ id: 'NUM-03', tier: 'foundation', prerequisites: ['NUM-01', 'NUM-02'] }),
    ]);
    expect(layers.get('NUM-03')).toBe(2);
  });

  it('does not let a filtered-out prerequisite hold a skill down', () => {
    // Filtering to one strand must not push its cross-strand dependants off the bottom.
    const layers = computeLayers([
      fakeSkill({ id: 'GEO-16', strand: 'GEO', tier: 'core', prerequisites: ['NUM-11'] }),
    ]);
    expect(layers.get('GEO-16')).toBe(1);
  });

  it('is deterministic', () => {
    const build = () => computeLayers(skills);
    expect([...build().entries()].sort()).toEqual([...build().entries()].sort());
  });
});

describe('layoutAtlas over the real Atlas', () => {
  it('places every skill exactly once', () => {
    expect(layout.nodes).toHaveLength(skills.length);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(skills.length);
  });

  it('is byte-identical across two runs, so a rebuild is not a diff', () => {
    const again = layoutAtlas(skills, problemCounts);
    expect(JSON.stringify(again)).toBe(JSON.stringify(layout));
  });

  it('draws every prerequisite edge that is in view', () => {
    const expected = skills.reduce((n, skill) => n + skill.prerequisites.length, 0);
    expect(layout.edges).toHaveLength(expected);
  });

  it('never draws an edge that points upward', () => {
    for (const edge of layout.edges) {
      expect(edge.y2, `${edge.from} -> ${edge.to}`).toBeGreaterThan(edge.y1);
    }
  });

  it('flags cross-strand edges so they can be drawn differently', () => {
    const cross = layout.edges.filter((e) => e.crossStrand);
    expect(cross.length).toBeGreaterThan(0);
    for (const edge of cross) {
      expect(edge.from.slice(0, 3)).not.toBe(edge.to.slice(0, 3));
    }
  });

  it('gives each strand its own column, in the canonical order', () => {
    expect(layout.columns.map((c) => c.strand)).toEqual([...STRANDS]);
    const xs = layout.columns.map((c) => c.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('keeps every node inside its strand column', () => {
    const columns = new Map(layout.columns.map((c) => [c.strand, c]));
    for (const node of layout.nodes) {
      const column = columns.get(node.strand);
      expect(column, node.id).toBeDefined();
      if (!column) continue;
      expect(node.x, node.id).toBeGreaterThanOrEqual(column.x - LAYOUT_CONSTANTS.slotWidth / 2);
      expect(node.x, node.id).toBeLessThanOrEqual(
        column.x + column.width + LAYOUT_CONSTANTS.slotWidth / 2,
      );
    }
  });

  it('never overlaps two nodes', () => {
    const seen = new Set<string>();
    for (const node of layout.nodes) {
      const key = `${node.x}:${node.y}`;
      expect(seen.has(key), `${node.id} overlaps another node`).toBe(false);
      seen.add(key);
    }
  });

  it('keeps every node inside the reported canvas', () => {
    for (const node of layout.nodes) {
      expect(node.x, node.id).toBeGreaterThan(0);
      expect(node.x, node.id).toBeLessThan(layout.width);
      expect(node.y, node.id).toBeGreaterThan(0);
      expect(node.y, node.id).toBeLessThan(layout.height);
    }
  });

  it('agrees with the content layer on which skill needs which', () => {
    const graph = getGraph();
    const edges = new Set(layout.edges.map((e) => `${e.from}->${e.to}`));
    for (const [id, prereqs] of graph.prerequisites) {
      for (const prereq of prereqs)
        expect(edges.has(`${prereq}->${id}`), `${prereq}->${id}`).toBe(true);
    }
  });

  it('carries the problem count onto every node', () => {
    for (const node of layout.nodes) {
      expect(node.problemCount, node.id).toBe(getProblemsForSkill(node.id).length);
    }
  });

  it('reports one tier band per tier present', () => {
    const bands = tierBands(layout);
    expect(bands.map((b) => b.tier)).toEqual(['foundation', 'core', 'gateway']);
    for (const band of bands) expect(band.to).toBeGreaterThanOrEqual(band.from);
  });
});

describe('layoutAtlas over a filtered subset', () => {
  const oneStrand = skills.filter((skill) => skill.strand === 'CNT');
  const filtered = layoutAtlas(oneStrand);

  it('lays out a single strand in a single column', () => {
    expect(filtered.columns).toHaveLength(1);
    expect(filtered.nodes).toHaveLength(oneStrand.length);
  });

  it('drops edges whose other end is out of view rather than drawing into nothing', () => {
    for (const edge of filtered.edges) {
      expect(filtered.nodes.some((n) => n.id === edge.from)).toBe(true);
      expect(filtered.nodes.some((n) => n.id === edge.to)).toBe(true);
    }
  });

  it('handles an empty set without dividing by zero', () => {
    const empty = layoutAtlas([]);
    expect(empty.nodes).toEqual([]);
    expect(empty.width).toBe(0);
    expect(empty.layerCount).toBe(0);
  });

  it('handles a single skill', () => {
    const single = layoutAtlas([fakeSkill({ id: 'NUM-01', tier: 'foundation' })]);
    expect(single.nodes).toHaveLength(1);
    expect(single.width).toBeGreaterThan(0);
    expect(single.height).toBeGreaterThan(0);
  });
});
