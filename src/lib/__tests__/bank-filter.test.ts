import { describe, it, expect } from 'vitest';
import { getAllProblems, getAllSkills } from '../content';
import { buildAmcIndex, buildAmcLookups, buildKaIndex, buildKaLookups } from '../bank-data';
import {
  EMPTY_FILTERS,
  amcBankRows,
  amcBankTaxonomy,
  bankFiltersToSearch,
  filterRows,
  groupCounts,
  kaBankRows,
  kaBankTaxonomy,
  parseBankFilters,
  practiceIds,
  randomUnsolved,
  sectionCount,
  taxonomyGroupNames,
  type BankRow,
} from '../bank-filter';
import type { MasteryState } from '../mastery';
import type { AmcProblem, AmcTaxonomy } from '../amc-schemas';

const problems = getAllProblems();
const taxonomy = kaBankTaxonomy(buildKaLookups(getAllSkills(), problems));
const rows = kaBankRows(buildKaIndex(problems), taxonomyGroupNames(taxonomy));
const none = new Map<string, MasteryState>();

describe('Kangaroo rows', () => {
  it('has one row per problem, with its skills primary first', () => {
    expect(rows).toHaveLength(problems.length);
    const first = problems[0];
    const row = rows.find((r) => r.id === first?.id);
    expect(row?.groups).toEqual([first?.skills.primary, ...(first?.skills.secondary ?? [])]);
    expect(row?.href).toBe(`/problem/${first?.id}`);
    expect(row?.levelLabel).toBe(`Level ${first?.band}`);
  });
});

describe('the URL', () => {
  it('round-trips a selection, in a stable order', () => {
    const filters = {
      ...EMPTY_FILTERS,
      level: '5-6',
      groups: ['GEO-02', 'CNT-01'],
      points: [5, 3] as Array<3 | 4 | 5>,
      status: ['solved', 'todo'] as Array<'todo' | 'attempted' | 'solved'>,
      figure: true,
      page: 2,
    };
    const search = bankFiltersToSearch(filters, taxonomy);
    expect(search).toBe(
      '?level=5-6&skill=CNT-01,GEO-02&points=3,5&status=todo,solved&figure=1&page=2',
    );
    expect(parseBankFilters(search, taxonomy)).toEqual({
      ...filters,
      groups: ['CNT-01', 'GEO-02'],
      points: [3, 5],
      status: ['todo', 'solved'],
    });
  });

  it('drops anything it does not recognise instead of throwing', () => {
    expect(
      parseBankFilters('?level=13-14&skill=XYZ-99&points=7&status=maybe&page=-3', taxonomy),
    ).toEqual(EMPTY_FILTERS);
  });

  it('reads the v2 bank keys, so old links still land', () => {
    const filters = parseBankFilters('?band=3-4&strand=LOG', taxonomy);
    expect(filters.level).toBe('3-4');
    const logSkills = taxonomy.sections.items.find((s) => s.id === 'LOG')?.groups.map((g) => g.id);
    expect(filters.groups).toEqual(logSkills);
  });

  it('writes nothing for the default view', () => {
    expect(bankFiltersToSearch(EMPTY_FILTERS, taxonomy)).toBe('');
  });
});

describe('counting and picking', () => {
  const statuses = new Map<string, MasteryState>(
    rows.slice(0, 3).map((row, index) => [row.id, index === 0 ? 'mastered' : 'seen']),
  );

  it('counts a skill as solved / total within the level', () => {
    const skill = rows[0]?.groups[0] ?? '';
    const counts = groupCounts(rows, EMPTY_FILTERS, statuses);
    expect(counts.get(skill)?.total).toBe(rows.filter((r) => r.groups.includes(skill)).length);
    expect(counts.get(skill)?.solved).toBe(1);
    const band = problems[0]?.band ?? '1-2';
    const inBand = groupCounts(rows, { ...EMPTY_FILTERS, level: band }, statuses);
    expect(inBand.get(skill)?.total).toBe(
      rows.filter((r) => r.groups.includes(skill) && r.levels.includes(band)).length,
    );
  });

  it('counts each problem once in a strand, however many of its skills it tags', () => {
    const strand = taxonomy.sections.items[0];
    const ids = strand?.groups.map((g) => g.id) ?? [];
    expect(sectionCount(rows, ids, EMPTY_FILTERS, none).total).toBe(
      rows.filter((r) => r.groups.some((g) => ids.includes(g))).length,
    );
  });

  it('starts practice with unsolved problems first, in list order, capped', () => {
    const ids = practiceIds(rows.slice(0, 5), statuses, 4);
    expect(ids).toEqual([rows[3]?.id, rows[4]?.id, rows[1]?.id, rows[2]?.id]);
  });

  it('draws a random problem from "to do" before "attempted", and none when all are solved', () => {
    const three = rows.slice(0, 3);
    expect(randomUnsolved(three, statuses, () => 0)?.id).toBe(rows[1]?.id);
    const allSolved = new Map(three.map((row) => [row.id, 'mastered' as MasteryState]));
    expect(randomUnsolved(three, allSolved)).toBeNull();
  });

  it('combines facets with AND and matches secondary skills', () => {
    const filters = {
      ...EMPTY_FILTERS,
      level: '5-6',
      groups: ['CNT-01'],
      points: [4] as Array<3 | 4 | 5>,
    };
    for (const row of filterRows(rows, filters, none)) {
      expect(row.levels).toContain('5-6');
      expect(row.groups).toContain('CNT-01');
      expect(row.points).toBe(4);
    }
  });
});

describe('the AMC adapter', () => {
  const amcTaxonomy: AmcTaxonomy = {
    areas: [
      { id: 'ALG', name: 'Algebra', description: 'x'.repeat(40) },
      { id: 'GEO', name: 'Geometry', description: 'x'.repeat(40) },
      { id: 'NT', name: 'Number theory', description: 'x'.repeat(40) },
      { id: 'CP', name: 'Counting and probability', description: 'x'.repeat(40) },
    ],
    topics: [
      {
        id: 'ALG-01',
        name: 'Linear equations',
        area: 'ALG',
        description: 'x'.repeat(40),
        amc12Only: false,
      },
    ],
    types: [
      {
        id: 'T-CASEWORK',
        name: 'Casework',
        description: 'x'.repeat(40),
        recognizeWhen: ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'],
        areas: ['CP'],
      },
    ],
  };
  const problem = {
    id: 'AM-0001',
    contest: 'BOTH',
    slot: 22,
    area: 'ALG',
    topic: 'ALG-01',
    types: ['T-CASEWORK'],
    statement: 'What is $1+1$?',
    figure: null,
  } as unknown as AmcProblem;
  const lookups = buildAmcLookups(amcTaxonomy, [problem]);
  const amc = amcBankTaxonomy(lookups);
  const [row] = amcBankRows(buildAmcIndex([problem]), taxonomyGroupNames(amc)) as [BankRow];

  it('puts a BOTH problem in both contests, as a Late tier, with its types as tags', () => {
    expect(row.levels).toEqual(['AMC10', 'AMC12']);
    expect(row.tierLabel).toBe('Late');
    expect(row.points).toBe(5);
    expect(row.tags).toEqual(['T-CASEWORK']);
    expect(row.math).toBe(true);
    expect(row.primaryName).toBe('Linear equations');
    expect(row.href).toBe('/amc/problem/AM-0001');
  });

  it('filters by contest, topic and type with AMC URL keys', () => {
    const filters = parseBankFilters('?level=AMC12&topic=ALG-01&type=T-CASEWORK', amc);
    expect(filterRows([row], filters, none)).toHaveLength(1);
    expect(bankFiltersToSearch(filters, amc)).toBe('?level=AMC12&topic=ALG-01&type=T-CASEWORK');
  });
});
