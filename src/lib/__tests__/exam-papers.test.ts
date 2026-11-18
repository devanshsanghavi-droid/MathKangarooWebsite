import { describe, expect, it } from 'vitest';
import {
  ACT_PAPER_SIZE,
  ACT_QUOTA,
  AMC_PAPER_SIZE,
  amcSectionRows,
  buildActMockPaper,
  buildAmcMockPaper,
  buildSatMockPaper,
  buildSectionPaper,
  kaSectionRows,
  SAT_MODULE_QUOTA,
  SAT_MODULE_SIZE,
  testSectionRows,
  type AmcPaperRow,
  type TestPaperRow,
} from '../exam-papers';
import { getAllAmcProblems } from '../amc-content';
import { getAllProblems } from '../content';
import { buildAmcIndex, buildKaIndex } from '../bank-data';
import type { TestDifficulty } from '../test-meta';

const RANK: Record<TestDifficulty, number> = { easy: 0, medium: 1, hard: 2 };

function amcRows(perSlot: number, contest: AmcPaperRow['contest'] = 'AMC10'): AmcPaperRow[] {
  const rows: AmcPaperRow[] = [];
  let n = 1;
  for (let slot = 1; slot <= 25; slot += 1) {
    for (let k = 0; k < perSlot; k += 1) {
      rows.push({ id: `AM-${String(n).padStart(4, '0')}`, contest, slot });
      n += 1;
    }
  }
  return rows;
}

function testRows(domains: Record<string, number>, prefix = 'SA'): TestPaperRow[] {
  const rows: TestPaperRow[] = [];
  let n = 1;
  for (const [domain, count] of Object.entries(domains)) {
    for (let k = 0; k < count; k += 1) {
      const difficulty = (['easy', 'medium', 'hard'] as const)[k % 3] ?? 'easy';
      rows.push({ id: `${prefix}-${String(n).padStart(4, '0')}`, domain, difficulty });
      n += 1;
    }
  }
  return rows;
}

function isRising(rows: readonly TestPaperRow[]): boolean {
  return rows.every(
    (row, i) => i === 0 || RANK[(rows[i - 1] as TestPaperRow).difficulty] <= RANK[row.difficulty],
  );
}

describe('the AMC mock paper', () => {
  it('takes one problem per slot, in slot order', () => {
    const rows = amcRows(3);
    const slotOf = new Map(rows.map((r) => [r.id, r.slot]));
    const paper = buildAmcMockPaper(rows, 'AMC10', 7);
    expect(paper.shortfall).toBe(0);
    expect(paper.borrowed).toBe(0);
    expect(paper.problemIds.map((id) => slotOf.get(id))).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
  });

  it('is the same paper for the same seed, and a different one for another', () => {
    const rows = amcRows(3);
    expect(buildAmcMockPaper(rows, 'AMC10', 7)).toEqual(buildAmcMockPaper(rows, 'AMC10', 7));
    expect(buildAmcMockPaper(rows, 'AMC10', 7).problemIds).not.toEqual(
      buildAmcMockPaper(rows, 'AMC10', 8).problemIds,
    );
  });

  it('fills an empty slot from a neighbour', () => {
    const rows = amcRows(2).filter((row) => row.slot !== 13);
    const slotOf = new Map(rows.map((r) => [r.id, r.slot]));
    const paper = buildAmcMockPaper(rows, 'AMC10', 1);
    expect(paper.problemIds).toHaveLength(25);
    expect(paper.borrowed).toBe(1);
    expect([12, 14]).toContain(slotOf.get(paper.problemIds[12] ?? ''));
    expect(new Set(paper.problemIds).size).toBe(25);
  });

  it('reports a shortfall rather than building a short paper', () => {
    const paper = buildAmcMockPaper(amcRows(1).slice(0, 20), 'AMC10', 1);
    expect(paper).toMatchObject({ problemIds: [], shortfall: 5 });
  });

  it('keeps BOTH off the AMC 8 paper and AMC 8 off the others', () => {
    const both = amcRows(1, 'BOTH');
    expect(buildAmcMockPaper(both, 'AMC8', 1).shortfall).toBe(25);
    expect(buildAmcMockPaper(both, 'AMC12', 1).shortfall).toBe(0);
    expect(buildAmcMockPaper(amcRows(1, 'AMC8'), 'AMC10', 1).shortfall).toBe(25);
  });

  it('builds from the real bank wherever it holds 25 problems for a paper', () => {
    const index = buildAmcIndex(getAllAmcProblems());
    for (const paper of ['AMC8', 'AMC10', 'AMC12'] as const) {
      const result = buildAmcMockPaper(index.rows, paper, 3);
      if (result.shortfall > 0) continue;
      expect(result.problemIds).toHaveLength(AMC_PAPER_SIZE);
      expect(new Set(result.problemIds).size).toBe(AMC_PAPER_SIZE);
    }
  });
});

describe('the SAT mock paper', () => {
  const rows = testRows({ ALG: 30, ADV: 30, PSD: 12, GEO: 12 });
  const byId = new Map(rows.map((row) => [row.id, row]));

  it('is two modules of 22 with the domain mix and rising difficulty', () => {
    const paper = buildSatMockPaper(rows, 11);
    expect(paper.shortfall).toBe(0);
    expect(paper.modules).toEqual([22, 22]);
    expect(new Set(paper.problemIds).size).toBe(44);
    for (const m of [0, 1]) {
      const block = paper.problemIds
        .slice(m * SAT_MODULE_SIZE, (m + 1) * SAT_MODULE_SIZE)
        .map((id) => byId.get(id) as TestPaperRow);
      for (const [domain, quota] of Object.entries(SAT_MODULE_QUOTA)) {
        expect(
          block.filter((row) => row.domain === domain),
          domain,
        ).toHaveLength(quota);
      }
      expect(isRising(block)).toBe(true);
      // Spread over difficulties rather than all of one.
      expect(new Set(block.map((row) => row.difficulty)).size).toBe(3);
    }
  });

  it('tops a short domain up from the others instead of failing', () => {
    const thin = testRows({ ALG: 40, ADV: 40, PSD: 2, GEO: 2 });
    const paper = buildSatMockPaper(thin, 1);
    expect(paper.problemIds).toHaveLength(44);
    expect(new Set(paper.problemIds).size).toBe(44);
  });

  it('reports a shortfall when the bank is too small', () => {
    expect(buildSatMockPaper(rows.slice(0, 40), 1)).toMatchObject({ problemIds: [], shortfall: 4 });
  });
});

describe('the ACT mock paper', () => {
  it('is 45 questions across the five categories, easiest first', () => {
    const rows = testRows({ NQ: 15, ALG: 15, FUN: 15, GEO: 15, STAT: 15 }, 'AC');
    const byId = new Map(rows.map((row) => [row.id, row]));
    const paper = buildActMockPaper(rows, 5);
    expect(paper.problemIds).toHaveLength(ACT_PAPER_SIZE);
    const block = paper.problemIds.map((id) => byId.get(id) as TestPaperRow);
    for (const [domain, quota] of Object.entries(ACT_QUOTA)) {
      expect(
        block.filter((row) => row.domain === domain),
        domain,
      ).toHaveLength(quota);
    }
    expect(isRising(block)).toBe(true);
  });
});

describe('section papers', () => {
  it('spread across tiers, ordered by rank, at most the size asked for', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `X-${String(i).padStart(4, '0')}`,
      bucket: i % 3,
      rank: i % 3,
    }));
    const paper = buildSectionPaper(rows, 10, 4);
    expect(paper.problemIds).toHaveLength(10);
    const rank = new Map(rows.map((r) => [r.id, r.rank]));
    const ranks = paper.problemIds.map((id) => rank.get(id) ?? -1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks.filter((r) => r === 0).length).toBeGreaterThanOrEqual(3);
    expect(ranks.filter((r) => r === 2).length).toBeGreaterThanOrEqual(3);
    expect(buildSectionPaper(rows, 10, 4)).toEqual(paper);
  });

  it('report how many a thin section is short', () => {
    const rows = [{ id: 'X-1', bucket: 0, rank: 0 }];
    expect(buildSectionPaper(rows, 10, 1)).toEqual({ problemIds: ['X-1'], shortfall: 9 });
  });

  it('select by level and strand, paper and area, or domain', () => {
    const ka = buildKaIndex(getAllProblems()).rows;
    const pick = ka[0];
    if (!pick) throw new Error('no Kangaroo content');
    const rows = kaSectionRows(ka, pick.band, pick.strand);
    expect(rows.length).toBeGreaterThan(0);
    const ids = new Set(rows.map((r) => r.id));
    expect(
      ka
        .filter((r) => ids.has(r.id))
        .every((r) => r.band === pick.band && r.strand === pick.strand),
    ).toBe(true);

    const amc = [
      { id: 'AM-0001', contest: 'BOTH' as const, slot: 3, area: 'ALG' },
      { id: 'AM-0002', contest: 'AMC12' as const, slot: 22, area: 'ALG' },
      { id: 'AM-0003', contest: 'AMC10' as const, slot: 12, area: 'GEO' },
      { id: 'AM-1001', contest: 'AMC8' as const, slot: 2, area: 'ALG' },
    ];
    expect(amcSectionRows(amc, 'AMC12', 'ALG')).toEqual([
      { id: 'AM-0001', bucket: 0, rank: 3 },
      { id: 'AM-0002', bucket: 2, rank: 22 },
    ]);
    expect(amcSectionRows(amc, 'AMC8', 'ALG').map((r) => r.id)).toEqual(['AM-1001']);

    const test = testRows({ ALG: 3, GEO: 2 });
    expect(testSectionRows(test, 'GEO').map((r) => r.bucket)).toEqual([0, 1]);
  });
});
