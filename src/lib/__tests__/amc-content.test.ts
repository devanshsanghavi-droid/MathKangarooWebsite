import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { buildAmcIndex, countAmcProblems } from '../amc-content';
import type { AmcProblem } from '../amc-schemas';

const index = buildAmcIndex(join(process.cwd(), 'content', 'amc'));

describe('AMC content index', () => {
  it('loads the taxonomy with all four areas and 8-12 topics in each', () => {
    expect(index.taxonomy.areas.map((a) => a.id)).toEqual(['ALG', 'GEO', 'NT', 'CP']);
    for (const area of ['ALG', 'GEO', 'NT', 'CP']) {
      const n = index.taxonomy.topics.filter((t) => t.area === area).length;
      expect(n, area).toBeGreaterThanOrEqual(8);
      expect(n, area).toBeLessThanOrEqual(12);
    }
    expect(index.taxonomy.types.length).toBeGreaterThanOrEqual(25);
    expect(index.taxonomy.types.length).toBeLessThanOrEqual(35);
  });

  it('sorts problems by id and finds the samples by id', () => {
    const ids = index.problems.map((p) => p.id);
    expect(ids).toEqual([...ids].sort());
    expect(index.problemById.get('AM-0998')?.contest).toBe('AMC12');
  });

  it('puts formulas in area order', () => {
    const areas = index.formulas.map((f) => f.area);
    const order = ['ALG', 'GEO', 'NT', 'CP'];
    expect(areas).toEqual([...areas].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});

describe('countAmcProblems', () => {
  const p = (id: string, patch: Partial<AmcProblem>): AmcProblem =>
    ({
      id,
      contest: 'AMC10',
      slot: 5,
      area: 'ALG',
      topic: 'ALG-01',
      types: ['T-PIE'],
      ...patch,
    }) as AmcProblem;

  it('counts BOTH problems under each contest and tiers by slot', () => {
    const counts = countAmcProblems([
      p('AM-0001', { contest: 'BOTH', slot: 3 }),
      p('AM-0002', { contest: 'AMC12', slot: 15, area: 'NT', topic: 'NT-01' }),
      p('AM-0003', { slot: 24, types: ['T-PIE', 'T-CASEWORK'] }),
    ]);
    expect(counts.total).toBe(3);
    expect(counts.byContest.get('AMC10')).toBe(2);
    expect(counts.byContest.get('AMC12')).toBe(2);
    expect(counts.byTier.get('Early')).toBe(1);
    expect(counts.byTier.get('Middle')).toBe(1);
    expect(counts.byTier.get('Late')).toBe(1);
    expect(counts.byArea.get('ALG')).toBe(2);
    expect(counts.byArea.get('GEO')).toBe(0);
    expect(counts.byTopic.get('ALG-01')).toBe(2);
    expect(counts.byType.get('T-PIE')).toBe(3);
    expect(counts.byType.get('T-CASEWORK')).toBe(1);
  });
});

/*
 * docs/06 §6: the Kangaroo quality bar applies to AMC. These are the mechanical parts of it
 * that scripts/__tests__/content-quality.test.ts already enforces for the Kangaroo bank.
 */
describe('AMC authoring rules', () => {
  it.each(index.problems.map((p) => [p.id, p] as const))(
    '%s writes every misconception in the first person, once per wrong choice',
    (_id, problem) => {
      const wrong = problem.choices.filter((c) => !c.correct);
      expect(wrong).toHaveLength(4);
      const texts = wrong.map((c) => c.misconception?.trim().toLowerCase());
      expect(new Set(texts).size, 'two distractors share a misconception').toBe(4);
      for (const choice of wrong) {
        expect(choice.misconception, `${problem.id} ${choice.key}`).toMatch(/^I\b/);
      }
    },
  );

  it.each(index.problems.map((p) => [p.id, p] as const))(
    '%s has five distinct answers and a three-rung hint ladder',
    (_id, problem) => {
      const texts = problem.choices.map((c) => c.text.replace(/\s+/g, ''));
      expect(new Set(texts).size).toBe(5);
      // AMC hints carry KaTeX and a strategy can be a single displayed equation, so the
      // Kangaroo "nudge is the shortest rung" length check does not transfer; the ladder must
      // still have three non-empty rungs.
      expect(problem.hints).toHaveLength(3);
      for (const hint of problem.hints) expect(hint.trim().length).toBeGreaterThan(0);
      expect(problem.hints[2].length).toBeGreaterThanOrEqual(20);
    },
  );
});
