import type { Problem, Skill } from './schemas';
import type { AmcProblem, AmcTaxonomy } from './amc-schemas';
import type { TestProblem, TestTaxonomy } from './test-schemas';
import { buildKaLookups } from './bank-data';
import type { BankSpec, ProblemGroup } from './progress-analytics';

/**
 * Builds the per-bank descriptions /progress needs (see BankSpec in progress-analytics.ts)
 * from content, at build time. Pure: the page passes in what the content layers loaded, and
 * tests pass fixtures. Only ids, names and the grouping travel to the browser, never a
 * statement, answer or solution.
 */

function grouped<T>(
  items: readonly T[],
  keyOf: (item: T) => { sub: string | null; meta: string | null },
  idOf: (item: T) => string,
): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();
  for (const item of items) {
    const { sub, meta } = keyOf(item);
    const key = `${sub ?? ''}|${meta ?? ''}`;
    let group = groups.get(key);
    if (!group) {
      group = { sub, meta, ids: [] };
      groups.set(key, group);
    }
    group.ids.push(idOf(item));
  }
  return [...groups.values()]
    .map((g) => ({ ...g, ids: [...g.ids].sort() }))
    .sort((a, b) =>
      `${a.sub ?? ''}|${a.meta ?? ''}`.localeCompare(`${b.sub ?? ''}|${b.meta ?? ''}`),
    );
}

/** Kangaroo: strands -> skills (Atlas order); problems grouped by band for the section level. */
export function kangarooBankSpec(skills: readonly Skill[], problems: readonly Problem[]): BankSpec {
  const lookups = buildKaLookups(skills, problems);
  return {
    bank: 'KA',
    sections: lookups.strands
      .filter((strand) => strand.skills.length > 0)
      .map((strand) => ({
        id: strand.id,
        name: strand.name,
        subs: strand.skills.map((s) => ({ id: s.id, name: s.name })),
      })),
    groups: grouped(
      problems,
      (p) => ({ sub: null, meta: p.band }),
      (p) => p.id,
    ),
  };
}

/** AMC: areas -> topics; problems grouped by topic and contest. */
export function amcBankSpec(taxonomy: AmcTaxonomy, problems: readonly AmcProblem[]): BankSpec {
  return {
    bank: 'AMC',
    sections: taxonomy.areas.map((area) => ({
      id: area.id,
      name: area.name,
      subs: taxonomy.topics
        .filter((topic) => topic.area === area.id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((topic) => ({ id: topic.id, name: topic.name })),
    })),
    groups: grouped(
      problems,
      (p) => ({ sub: p.topic, meta: p.contest }),
      (p) => p.id,
    ),
  };
}

/** SAT or ACT: domains -> skills (taxonomy order); problems grouped by skill. */
export function testBankSpec(taxonomy: TestTaxonomy, problems: readonly TestProblem[]): BankSpec {
  return {
    bank: taxonomy.test,
    sections: taxonomy.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      subs: domain.skills.map((s) => ({ id: s.id, name: s.name })),
    })),
    groups: grouped(
      problems,
      (p) => ({ sub: p.skill, meta: null }),
      (p) => p.id,
    ),
  };
}
