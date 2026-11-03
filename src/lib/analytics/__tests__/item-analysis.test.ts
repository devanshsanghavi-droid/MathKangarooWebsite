import { describe, it, expect } from 'vitest';
import {
  analyseItems,
  CALIBRATION_MIN_N,
  discriminationIndex,
  pointBiserial,
  PUBLISH_MIN_N,
  type RespondentRecord,
} from '../item-analysis.ts';
import type { ChoiceKey } from '../../schemas.ts';

/**
 * These are hand-computable on purpose. A psychometric statistic that is subtly wrong does
 * not throw - it quietly recommends rewriting the wrong problems, forever.
 */

describe('point-biserial correlation', () => {
  it('matches the hand-computed value for a clean split', () => {
    // scores [3,2,1,0]; indicator picks the top two.
    //   M1 = 2.5, M0 = 0.5, population SD = sqrt(1.25) = 1.118034, p = q = 0.5
    //   r = (2.5 - 0.5) / 1.118034 * 0.5 = 0.894427
    const r = pointBiserial([true, true, false, false], [3, 2, 1, 0]);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0.894427, 6);
  });

  it('is the exact negative when the indicator picks the bottom two', () => {
    const r = pointBiserial([false, false, true, true], [3, 2, 1, 0]);
    expect(r as number).toBeCloseTo(-0.894427, 6);
  });

  it('is null rather than zero when nobody has the indicator', () => {
    // "Undefined" and "no relationship" are different claims. Only one of them is true here.
    expect(pointBiserial([false, false, false], [3, 2, 1])).toBeNull();
    expect(pointBiserial([true, true, true], [3, 2, 1])).toBeNull();
  });

  it('is null when every total score is identical', () => {
    expect(pointBiserial([true, false, true, false], [2, 2, 2, 2])).toBeNull();
  });

  it('is null on mismatched or empty input', () => {
    expect(pointBiserial([true], [1, 2])).toBeNull();
    expect(pointBiserial([], [])).toBeNull();
  });
});

describe('discrimination index', () => {
  it('is 1 when only the strongest got it right and only the weakest got it wrong', () => {
    expect(discriminationIndex([true, true, false, false], [3, 2, 1, 0])).toBe(1);
  });

  it('is negative when the weak students outperform the strong ones on this item', () => {
    expect(discriminationIndex([false, false, true, true], [3, 2, 1, 0])).toBe(-1);
  });

  it('is null below four respondents, where the split is meaningless', () => {
    expect(discriminationIndex([true, false, true], [3, 2, 1])).toBeNull();
  });

  it('splits at 27% of the cohort', () => {
    // 100 respondents, top 27 all right, bottom 27 all wrong -> D = 1.
    const totals = Array.from({ length: 100 }, (_u, i) => 100 - i);
    const rights = totals.map((_t, i) => i < 27);
    expect(discriminationIndex(rights, totals)).toBe(1);
  });
});

/* ------------------------------------------------------------------------- */

const KEY: Record<string, ChoiceKey> = { 'KA-0001': 'C', 'KA-0002': 'A', 'KA-0003': 'A' };
const correctKeyFor = (id: string) => KEY[id];

/** `strong` students answer KA-0001 correctly; `weak` ones fall for B. */
function cohort(): RespondentRecord[] {
  const records: RespondentRecord[] = [];
  for (let i = 0; i < 20; i += 1) {
    const strong = i < 10;
    records.push({
      respondent: `s${i}`,
      responses: [
        { problemId: 'KA-0001', choiceKey: strong ? 'C' : 'B', correct: strong },
        // Everyone gets KA-0002 right: a trivial item, and the flags should say so.
        { problemId: 'KA-0002', choiceKey: 'A', correct: true },
      ],
    });
  }
  return records;
}

describe('analysing a cohort', () => {
  const stats = analyseItems(cohort(), correctKeyFor);

  it('reports one row per item that clears the minimum', () => {
    expect(stats.map((s) => s.problemId)).toEqual(['KA-0001', 'KA-0002']);
    expect(stats[0]?.n).toBe(20);
  });

  it('measures difficulty rather than taking the authored word for it', () => {
    expect(stats[0]?.pValue).toBe(0.5);
    expect(stats[1]?.pValue).toBe(1);
  });

  it('gives the correct option a positive point-biserial', () => {
    const correct = stats[0]?.options.find((o) => o.key === 'C');
    expect(correct?.isCorrectOption).toBe(true);
    expect(correct?.pointBiserial as number).toBeGreaterThan(0);
  });

  it('gives a working distractor a negative point-biserial', () => {
    const b = stats[0]?.options.find((o) => o.key === 'B');
    expect(b?.count).toBe(10);
    expect(b?.pointBiserial as number).toBeLessThan(0);
    expect(b?.attractsStrongStudents).toBe(false);
  });

  it('marks distractors nobody picks as doing no work', () => {
    const dead = stats[0]?.options.filter((o) => o.nonFunctioning).map((o) => o.key);
    expect(dead).toEqual(['A', 'D', 'E']);
    expect(stats[0]?.distractorEfficiency).toBeCloseTo(0.25, 6);
  });

  it('flags an item everybody gets right', () => {
    expect(stats[1]?.flags.join(' ')).toMatch(/too easy/);
  });

  it('suppresses items below the minimum cohort size', () => {
    const thin = analyseItems(cohort().slice(0, 3), correctKeyFor);
    expect(thin).toEqual([]);
    expect(PUBLISH_MIN_N).toBe(10);
    expect(CALIBRATION_MIN_N).toBe(30);
  });
});

describe('the signal worth having', () => {
  it('flags a distractor that STRONGER students fall for', () => {
    // Ten strong students, six of whom pick D; ten weak ones who pick B. D correlates with
    // ability, which means the item is flawed or D is a trap that survives competence.
    const records: RespondentRecord[] = [];
    for (let i = 0; i < 20; i += 1) {
      const strong = i < 10;
      const key: ChoiceKey = strong ? (i < 6 ? 'D' : 'C') : 'B';
      records.push({
        respondent: `s${i}`,
        responses: [
          { problemId: 'KA-0001', choiceKey: key, correct: key === 'C' },
          // A second item the strong students win, so total score actually ranks them.
          { problemId: 'KA-0002', choiceKey: strong ? 'A' : 'B', correct: strong },
        ],
      });
    }
    const stats = analyseItems(records, correctKeyFor);
    const item = stats.find((s) => s.problemId === 'KA-0001');
    const d = item?.options.find((o) => o.key === 'D');
    expect(d?.attractsStrongStudents).toBe(true);
    expect(d?.pointBiserial as number).toBeGreaterThan(0);
    expect(item?.flags.join(' ')).toMatch(/D attracts stronger students/);
  });

  it('flags a mis-keyed item, where the correct answer anti-correlates with ability', () => {
    // Two further items rank the cohort, so the strong students still out-total the weak ones
    // despite losing KA-0001. Without them every total is 1, there is no variance to correlate
    // against, and the statistic is undefined rather than negative - which is what the first
    // draft of this fixture accidentally tested.
    const records: RespondentRecord[] = [];
    for (let i = 0; i < 20; i += 1) {
      const strong = i < 10;
      records.push({
        respondent: `s${i}`,
        responses: [
          // The weak students "get it right" - a classic sign the key is wrong.
          { problemId: 'KA-0001', choiceKey: strong ? 'B' : 'C', correct: !strong },
          { problemId: 'KA-0002', choiceKey: strong ? 'A' : 'B', correct: strong },
          { problemId: 'KA-0003', choiceKey: strong ? 'A' : 'B', correct: strong },
        ],
      });
    }
    const item = analyseItems(records, correctKeyFor).find((s) => s.problemId === 'KA-0001');
    expect(item?.discriminationRpb as number).toBeLessThan(0);
    expect(item?.flags.join(' ')).toMatch(/check the key/);
  });

  it('declines to compute rather than guessing when every total score is identical', () => {
    // The degenerate cohort: whatever you win on one item you lose on the other. There is no
    // ability ordering here, so every correlation is undefined and none is reported as zero.
    const records: RespondentRecord[] = [];
    for (let i = 0; i < 20; i += 1) {
      const strong = i < 10;
      records.push({
        respondent: `s${i}`,
        responses: [
          { problemId: 'KA-0001', choiceKey: strong ? 'B' : 'C', correct: !strong },
          { problemId: 'KA-0002', choiceKey: strong ? 'A' : 'B', correct: strong },
        ],
      });
    }
    const item = analyseItems(records, correctKeyFor).find((s) => s.problemId === 'KA-0001');
    expect(item?.discriminationRpb).toBeNull();
    expect(item?.flags.join(' ')).not.toMatch(/check the key/);
  });
});
