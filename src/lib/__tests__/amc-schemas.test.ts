import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AmcProblemSchema,
  AmcTaxonomySchema,
  FormulaSchema,
  amcTierOf,
  amcPointsOf,
  amcAreaOf,
  amcContestFolder,
  amcInContest,
  isAmcProblemId,
} from '../amc-schemas';

const AMC = join(process.cwd(), 'content', 'amc');
const read = (rel: string): unknown => JSON.parse(readFileSync(join(AMC, rel), 'utf8'));
const sample = () => read('problems/10/AM-0999.json') as Record<string, unknown>;

describe('AMC slot tiers', () => {
  it.each([
    [1, 'Early', 3],
    [10, 'Early', 3],
    [11, 'Middle', 4],
    [20, 'Middle', 4],
    [21, 'Late', 5],
    [25, 'Late', 5],
  ] as const)('slot %i is %s and records %i points', (slot, tier, points) => {
    expect(amcTierOf(slot)).toBe(tier);
    expect(amcPointsOf(slot)).toBe(points);
  });

  it.each([0, 26, 3.5, -1])('rejects slot %s', (slot) => {
    expect(() => amcTierOf(slot)).toThrow(RangeError);
  });
});

describe('AMC id helpers', () => {
  it('recognises AM ids and nothing else', () => {
    expect(isAmcProblemId('AM-0001')).toBe(true);
    expect(isAmcProblemId('KA-0001')).toBe(false);
    expect(isAmcProblemId('AM-001')).toBe(false);
  });

  it('reads the area off topic and formula ids', () => {
    expect(amcAreaOf('ALG-03')).toBe('ALG');
    expect(amcAreaOf('F-NT-12')).toBe('NT');
    expect(amcAreaOf('NUM-01')).toBeNull();
  });

  it('files BOTH problems with the AMC 10 ones', () => {
    expect(amcContestFolder('AMC10')).toBe('10');
    expect(amcContestFolder('BOTH')).toBe('10');
    expect(amcContestFolder('AMC12')).toBe('12');
    expect(amcInContest('BOTH', 'AMC12')).toBe(true);
    expect(amcInContest('AMC10', 'AMC12')).toBe(false);
  });
});

describe('AMC schemas', () => {
  it('accepts the committed taxonomy, sample problems and sample formulas', () => {
    expect(AmcTaxonomySchema.safeParse(read('taxonomy.json')).success).toBe(true);
    for (const file of [
      'problems/10/AM-0999.json',
      'problems/10/AM-0997.json',
      'problems/12/AM-0998.json',
    ]) {
      const result = AmcProblemSchema.safeParse(read(file));
      expect(result.success, file).toBe(true);
    }
    for (const file of [
      'formulas/ALG/F-ALG-01.json',
      'formulas/GEO/F-GEO-01.json',
      'formulas/NT/F-NT-01.json',
      'formulas/CP/F-CP-01.json',
    ]) {
      expect(FormulaSchema.safeParse(read(file)).success, file).toBe(true);
    }
  });

  it.each([
    ['a Kangaroo id', { id: 'KA-0001' }],
    ['a slot past 25', { slot: 26 }],
    ['a bad topic id', { topic: 'ALGEBRA-1' }],
    ['a lowercase type id', { types: ['T-telescope'] }],
    ['no types', { types: [] }],
    ['four types', { types: ['T-PIE', 'T-COMPLEMENT', 'T-CASEWORK', 'T-SYMMETRY'] }],
    ['a bad formula id', { formulas: ['F-ALG-1'] }],
    ['an unknown contest', { contest: 'AMC8' }],
    ['an extra field', { tier: 'Early' }],
  ])('rejects %s', (_label, patch) => {
    expect(AmcProblemSchema.safeParse({ ...sample(), ...patch }).success).toBe(false);
  });

  it('rejects a taxonomy type with too few recognition cues', () => {
    const taxonomy = read('taxonomy.json') as { types: Array<Record<string, unknown>> };
    const first = taxonomy.types[0];
    if (!first) throw new Error('taxonomy has no types');
    first.recognizeWhen = ['only one cue here'];
    expect(AmcTaxonomySchema.safeParse(taxonomy).success).toBe(false);
  });
});
