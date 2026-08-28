import { describe, it, expect } from 'vitest';
import {
  expectedQuestionCount,
  isComplete,
  mostTestedSkills,
  paperSlug,
  paperTitle,
  papersByBand,
  parsePaperSlug,
  pointDistribution,
} from '../papers';
import { buildContentIndex } from '../content';
import { join } from 'node:path';
import type { PaperIndex } from '../schemas';

const fixtureIndex = buildContentIndex(
  join(process.cwd(), 'scripts', '__fixtures__', 'skill-reference', 'pass', 'content'),
);
const fixturePaper = [...fixtureIndex.papers.values()][0];

function paper(partial: Partial<PaperIndex> = {}): PaperIndex {
  return {
    year: 2019,
    band: '5-6',
    officialPdfUrl: 'https://mathkangaroo.org/example.pdf',
    questions: [
      { number: 1, points: 3, skills: ['NUM-01'] },
      { number: 2, points: 3, skills: ['NUM-01', 'CNT-01'] },
      { number: 3, points: 4, skills: ['CNT-01'] },
      { number: 4, points: 5, skills: ['GEO-10'] },
    ],
    ...partial,
  };
}

describe('titles and slugs', () => {
  it('writes the level with an en dash, as the papers do', () => {
    expect(paperTitle({ year: 2019, band: '5-6' })).toBe('2019, level 5–6');
  });

  it('round-trips a slug', () => {
    const slug = paperSlug({ year: 2019, band: '11-12' });
    expect(slug).toBe('2019-11-12');
    expect(parsePaperSlug(slug)).toEqual({ year: 2019, band: '11-12' });
  });

  it('returns null on a slug that is not one', () => {
    for (const bad of ['', 'nope', '19-3-4', '2019', '2019-x', '../etc/passwd']) {
      expect(parsePaperSlug(bad), bad).toBeNull();
    }
  });
});

describe('pointDistribution', () => {
  it('counts the questions at each tier, including tiers with none', () => {
    const counts = pointDistribution(paper());
    expect(counts.get(3)).toBe(2);
    expect(counts.get(4)).toBe(1);
    expect(counts.get(5)).toBe(1);
  });

  it('always reports all three tiers so a chart has no missing bar', () => {
    const counts = pointDistribution(
      paper({ questions: [{ number: 1, points: 3, skills: ['NUM-01'] }] }),
    );
    expect([...counts.keys()].sort()).toEqual([3, 4, 5]);
    expect(counts.get(5)).toBe(0);
  });
});

describe('mostTestedSkills', () => {
  it('counts a question once for each skill it tags', () => {
    const frequencies = mostTestedSkills([paper()]);
    expect(frequencies.find((f) => f.skillId === 'NUM-01')?.count).toBe(2);
    expect(frequencies.find((f) => f.skillId === 'CNT-01')?.count).toBe(2);
    expect(frequencies.find((f) => f.skillId === 'GEO-10')?.count).toBe(1);
  });

  it('reports share as a share of questions, so the shares may exceed one', () => {
    const frequencies = mostTestedSkills([paper()]);
    const total = frequencies.reduce((sum, f) => sum + f.share, 0);
    expect(total).toBeGreaterThan(1);
    expect(frequencies.find((f) => f.skillId === 'NUM-01')?.share).toBeCloseTo(0.5);
  });

  it('sorts commonest first, breaking ties on id so a rebuild is not a diff', () => {
    const frequencies = mostTestedSkills([paper()]);
    expect(frequencies.map((f) => f.skillId)).toEqual(['CNT-01', 'NUM-01', 'GEO-10']);
  });

  it('records the point tiers a skill was tested at', () => {
    const frequencies = mostTestedSkills([paper()]);
    expect(frequencies.find((f) => f.skillId === 'CNT-01')?.points).toEqual([3, 4]);
  });

  it('honours a limit', () => {
    expect(mostTestedSkills([paper()], 2)).toHaveLength(2);
  });

  it('returns nothing for no papers rather than dividing by zero', () => {
    expect(mostTestedSkills([])).toEqual([]);
    expect(mostTestedSkills([paper({ questions: [] })])).toEqual([]);
  });

  it('aggregates across several papers', () => {
    const frequencies = mostTestedSkills([paper(), paper({ year: 2020 })]);
    expect(frequencies.find((f) => f.skillId === 'NUM-01')?.count).toBe(4);
  });

  it('works on a real fixture paper file', () => {
    expect(fixturePaper).toBeDefined();
    if (!fixturePaper) return;
    const frequencies = mostTestedSkills([fixturePaper]);
    expect(frequencies[0]?.skillId).toBe('NUM-01');
    expect(frequencies[0]?.count).toBe(2);
  });
});

describe('papersByBand', () => {
  it('groups and sorts newest first', () => {
    const grouped = papersByBand([
      paper({ year: 2018 }),
      paper({ year: 2021 }),
      paper({ year: 2020, band: '3-4' }),
    ]);
    expect(grouped.get('5-6')?.map((p) => p.year)).toEqual([2021, 2018]);
    expect(grouped.get('3-4')?.map((p) => p.year)).toEqual([2020]);
  });
});

describe('expectedQuestionCount', () => {
  it('matches the official paper structure', () => {
    // Public fact, not analysis: docs/01-DATA-MODEL.md §3.5.
    expect(expectedQuestionCount('1-2')).toBe(24);
    expect(expectedQuestionCount('3-4')).toBe(24);
    expect(expectedQuestionCount('5-6')).toBe(30);
    expect(expectedQuestionCount('11-12')).toBe(30);
  });

  it('marks a partial index as incomplete', () => {
    expect(isComplete(paper())).toBe(false);
    expect(
      isComplete(
        paper({
          questions: Array.from({ length: 30 }, (_, index) => ({
            number: index + 1,
            points: 3 as const,
            skills: ['NUM-01'],
          })),
        }),
      ),
    ).toBe(true);
  });
});
