import { describe, it, expect } from 'vitest';
import { getAllAmcProblems, getAmcFormulas, getAmcTaxonomy } from '../amc-content';
import { amcInContest, amcTierOf } from '../amc-schemas';
import { buildAmcIndex, buildAmcLookups } from '../bank-data';
import {
  EMPTY_FILTERS,
  amcBankRows,
  amcBankTaxonomy,
  bankFiltersToSearch,
  facetCount,
  filterRows,
  groupCounts,
  parseBankFilters,
  practiceIds,
  statusMap,
  taxonomyGroupNames,
  type BankFilters,
} from '../bank-filter';
import { EMPTY_PROGRESS, recordAmcAttempt, type ProgressFile } from '../local-progress';
import type { MasteryState } from '../mastery';
import { parsePracticeSetQuery, practiceSetHref } from '../practice-item';
import { filterFormulas } from '../formula-sheet';
import { mixedSetIds, onPaper, type AmcHomeProblem } from '../amc-home';

/*
 * The AMC bank's filters (docs/06 §5) over the real content/amc corpus: contest, area ->
 * topic, problem type, tier and status. Content is still being written, so assertions are
 * about relationships (every match satisfies the filter, nothing is lost), never exact counts.
 */

const problems = getAllAmcProblems();
const taxonomy = amcBankTaxonomy(buildAmcLookups(getAmcTaxonomy(), problems));
const rows = amcBankRows(buildAmcIndex(problems), taxonomyGroupNames(taxonomy));
const byId = new Map(problems.map((problem) => [problem.id, problem]));
const none = new Map<string, MasteryState>();
const filters = (patch: Partial<BankFilters>): BankFilters => ({ ...EMPTY_FILTERS, ...patch });

describe('the AMC bank filters', () => {
  it('has a row for every problem, linking to its AMC page', () => {
    expect(rows).toHaveLength(problems.length);
    for (const row of rows) expect(row.href).toBe(`/amc/problem/${row.id}`);
  });

  it('keeps AMC 12 only problems off the AMC 10 list, BOTH on 10 and 12, AMC 8 on its own', () => {
    for (const paper of ['AMC8', 'AMC10', 'AMC12'] as const) {
      const matched = filterRows(rows, filters({ level: paper }), none);
      const expected = problems.filter((p) => amcInContest(p.contest, paper));
      expect(matched.map((r) => r.id)).toEqual(expected.map((p) => p.id));
    }
  });

  it('filters by topic, and a whole area is the union of its topics', () => {
    for (const area of taxonomy.sections.items) {
      const topicIds = area.groups.map((group) => group.id);
      const matched = filterRows(rows, filters({ groups: topicIds }), none);
      expect(matched.map((r) => r.id)).toEqual(
        problems.filter((p) => p.area === area.id).map((p) => p.id),
      );
    }
  });

  it('filters by problem type: a problem matches if it carries any ticked type', () => {
    const types = ['T-CASEWORK', 'T-VIETA'];
    const matched = filterRows(rows, filters({ tags: types }), none);
    expect(matched.length).toBeGreaterThan(0);
    for (const row of matched) {
      expect(byId.get(row.id)?.types.some((type) => types.includes(type))).toBe(true);
    }
    const missed = rows.filter((row) => !matched.includes(row));
    for (const row of missed) {
      expect(byId.get(row.id)?.types.some((type) => types.includes(type))).toBe(false);
    }
  });

  it('filters by tier through the slot: Early is 1-10, Middle 11-20, Late 21-25', () => {
    const tiers = { 3: 'Early', 4: 'Middle', 5: 'Late' } as const;
    for (const points of [3, 4, 5] as const) {
      const matched = filterRows(rows, filters({ points: [points] }), none);
      for (const row of matched) {
        expect(amcTierOf(byId.get(row.id)?.slot ?? 0)).toBe(tiers[points]);
        expect(row.tierLabel).toBe(tiers[points]);
      }
    }
  });

  it('reads status from attempts stored under the AM id', () => {
    const [first, second] = rows;
    if (!first || !second) throw new Error('the AMC bank needs at least two problems');
    let file: ProgressFile = EMPTY_PROGRESS;
    const at = '2026-11-14T10:00:00.000Z';
    file = recordAmcAttempt(
      first.id,
      byId.get(first.id)?.slot ?? 1,
      { correct: true, hintsUsed: 0, at },
      file,
    );
    file = recordAmcAttempt(
      second.id,
      byId.get(second.id)?.slot ?? 1,
      { correct: false, hintsUsed: 0, at },
      file,
    );
    const statuses = statusMap('amc', file, rows);
    expect(filterRows(rows, filters({ status: ['solved'] }), statuses).map((r) => r.id)).toEqual([
      first.id,
    ]);
    expect(filterRows(rows, filters({ status: ['attempted'] }), statuses).map((r) => r.id)).toEqual(
      [second.id],
    );
    expect(filterRows(rows, filters({ status: ['todo'] }), statuses)).toHaveLength(rows.length - 2);
    // Start practice hands over unsolved problems first.
    expect(practiceIds(rows, statuses, rows.length).at(-1)).toBe(first.id);
  });

  it('counts topics within the chosen contest', () => {
    const counts = groupCounts(rows, filters({ level: 'AMC10' }), none);
    for (const [topic, count] of counts) {
      const expected = problems.filter(
        (p) => p.topic === topic && amcInContest(p.contest, 'AMC10'),
      ).length;
      expect(count.total).toBe(expected);
    }
  });

  it('counts each type chip holding the other filters', () => {
    const base = filters({ level: 'AMC12', points: [5] });
    const ids = taxonomy.tags?.items.map((tag) => tag.id) ?? [];
    const counts = facetCount(
      rows,
      base,
      none,
      'tags',
      (row, tag: string) => row.tags.includes(tag),
      ids,
    );
    for (const id of ids) {
      expect(counts.get(id)).toBe(filterRows(rows, { ...base, tags: [id] }, none).length);
    }
  });

  it('mirrors AMC filters into the URL with AMC keys, and drops unknown values', () => {
    const parsed = parseBankFilters(
      '?level=AMC10&topic=ALG-01,NOPE-99&type=T-CASEWORK,T-FAKE&points=4,9&status=todo',
      taxonomy,
    );
    expect(parsed.level).toBe('AMC10');
    expect(parsed.groups).toEqual(['ALG-01']);
    expect(parsed.tags).toEqual(['T-CASEWORK']);
    expect(parsed.points).toEqual([4]);
    expect(bankFiltersToSearch(parsed, taxonomy)).toBe(
      '?level=AMC10&topic=ALG-01&type=T-CASEWORK&points=4&status=todo',
    );
    // A Kangaroo level is not an AMC contest.
    expect(parseBankFilters('?level=5-6', taxonomy).level).toBe('all');
  });
});

describe('AMC practice set links', () => {
  it('runs an AMC set under /amc/practice and reads back as an AMC set', () => {
    const href = practiceSetHref({ bank: 'amc', ids: ['AM-0001', 'AM-0002'], name: 'Casework' });
    expect(href).toBe('/amc/practice?bank=amc&ids=AM-0001,AM-0002&name=Casework');
    const query = parsePracticeSetQuery(new URL(href, 'http://x').search);
    expect(query).toEqual({ bank: 'amc', ids: ['AM-0001', 'AM-0002'], name: 'Casework' });
  });

  it('leaves Kangaroo sets at /practice/set', () => {
    expect(practiceSetHref({ ids: ['KA-0001'] })).toBe('/practice/set?ids=KA-0001');
  });
});

describe('the mixed set on /amc', () => {
  const home: AmcHomeProblem[] = problems.map((p) => ({
    id: p.id,
    slot: p.slot,
    contest: p.contest,
    area: p.area,
    topic: p.topic,
  }));
  const seeded = () => {
    let seed = 7;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  };

  it('takes only problems on the chosen paper, spread across areas, in slot order', () => {
    for (const paper of ['AMC8', 'AMC10', 'AMC12'] as const) {
      const ids = mixedSetIds(home, none, paper, 10, seeded());
      expect(ids.length).toBe(Math.min(10, home.filter((p) => onPaper(p, paper)).length));
      const picked = ids.map((id) => byId.get(id));
      for (const p of picked) expect(p && amcInContest(p.contest, paper)).toBe(true);
      const slots = picked.map((p) => p?.slot ?? 0);
      expect(slots).toEqual([...slots].sort((a, b) => a - b));
      const areas = new Set(picked.map((p) => p?.area));
      expect(areas.size).toBe(
        Math.min(4, new Set(home.filter((p) => onPaper(p, paper)).map((p) => p.area)).size),
      );
    }
  });

  it('prefers unsolved problems', () => {
    const solved = new Map<string, MasteryState>(home.slice(0, 200).map((p) => [p.id, 'mastered']));
    const ids = mixedSetIds(home, solved, 'AMC12', 10, seeded());
    const unsolvedLeft = home.slice(200).filter((p) => onPaper(p, 'AMC12'));
    if (unsolvedLeft.length >= 10) {
      for (const id of ids) expect(solved.has(id)).toBe(false);
    }
  });
});

describe('the formula sheet filter', () => {
  const formulas = getAmcFormulas();

  it('keeps must-know only when asked, and a contest filter keeps formulas tagged with it', () => {
    const must = filterFormulas(formulas, { mustOnly: true });
    expect(must.every((f) => f.priority === 'must-know')).toBe(true);
    for (const paper of ['AMC10', 'AMC12'] as const) {
      const shown = filterFormulas(formulas, { contest: paper });
      expect(shown).toEqual(formulas.filter((f) => f.contests.includes(paper)));
    }
    expect(filterFormulas(formulas, {})).toHaveLength(formulas.length);
  });

  it('lists formulas by area with must-know first inside each area', () => {
    const order = ['ALG', 'GEO', 'NT', 'CP'];
    for (let index = 1; index < formulas.length; index += 1) {
      const a = formulas[index - 1];
      const b = formulas[index];
      if (!a || !b) continue;
      const areaStep = order.indexOf(a.area) - order.indexOf(b.area);
      expect(areaStep).toBeLessThanOrEqual(0);
      if (a.area === b.area && a.priority === 'good-to-know')
        expect(b.priority).toBe('good-to-know');
    }
  });
});
