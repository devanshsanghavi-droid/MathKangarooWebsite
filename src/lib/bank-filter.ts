import type { Points } from './schemas';
import type { MasteryState } from './mastery';
import { bucketOf, statusOfProblem, amcStatusOf, type StatusBucket } from './progress-summary';
import type { ProgressFile } from './local-progress';
import type { AmcIndexFile, AmcLookups, KaIndexFile, KaLookups } from './bank-data';
import { amcContestLabel, kaLevelLabel, type PracticeBank } from './practice-item';
import { AMC_TIER_POINTS, AMC_TIER_SLOTS, AMC_TIERS } from './amc-tier';

/**
 * The question bank's model, shared by the Kangaroo bank (/problems) and the AMC bank
 * (/amc/problems). docs/06 §3-4: everything here runs in the browser over the static index, so
 * no filtered view is ever a request to a worker.
 *
 * Each bank adapts its index into `BankRow`s and describes its filters as a `BankTaxonomy`;
 * the filter panel, the list, the counts and the URL mirroring are then one implementation.
 *
 *   Kangaroo  level = band,     sections = strands -> skills,  no tags,   difficulty = 3/4/5 pt
 *   AMC       level = contest,  sections = areas -> topics,    tags = problem types,
 *             difficulty = Early / Middle / Late (stored as 3/4/5)
 */

export const BANK_PAGE_SIZE = 50;

export interface BankRow {
  id: string;
  href: string;
  /** Preview text: plain for Kangaroo, `$...$` KaTeX for AMC (see `math`). */
  statement: string;
  math: boolean;
  /** Difficulty tier as 3 / 4 / 5. */
  points: Points;
  /** Bank-specific tier name shown instead of "N pt" (AMC "Early"). */
  tierLabel: string | null;
  /** Level values this row belongs to. An AMC BOTH problem is in AMC10 and AMC12. */
  levels: string[];
  levelLabel: string;
  /** Section (strand / area) of the primary group. */
  section: string;
  /** Group ids the row is tagged with, primary first (skills / topic). */
  groups: string[];
  primaryName: string | null;
  /** Extra filterable tags (AMC problem types). */
  tags: string[];
  hasFigure: boolean;
}

export interface BankOption {
  value: string;
  label: string;
  ariaLabel?: string;
}

export interface BankTaxonomy {
  bank: PracticeBank;
  /** Singular noun for one row, "problem". */
  noun: string;
  level: { label: string; options: BankOption[] };
  sections: {
    label: string;
    items: Array<{ id: string; name: string; groups: Array<{ id: string; name: string }> }>;
  };
  tags: { label: string; items: Array<{ id: string; name: string }> } | null;
  difficulty: {
    label: string;
    options: Array<{ points: Points; label: string; description?: string }>;
  };
  /** URL keys, so a shared Kangaroo link reads `?skill=CNT-01` and an AMC one `?topic=ALG-03`. */
  params: { group: string; tag: string };
}

export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusBucket; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'solved', label: 'Solved' },
];

export interface BankFilters {
  /** 'all' or one of taxonomy.level.options' values. */
  level: string;
  groups: string[];
  tags: string[];
  points: Points[];
  status: StatusBucket[];
  figure: boolean;
  page: number;
}

export const EMPTY_FILTERS: BankFilters = {
  level: 'all',
  groups: [],
  tags: [],
  points: [],
  status: [],
  figure: false,
  page: 1,
};

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

/** One row's progress state, read the way its bank stores attempts (local-progress.ts). */
export function rowState(bank: PracticeBank, file: ProgressFile, row: BankRow): MasteryState {
  return bank === 'amc' ? amcStatusOf(file, row.id) : statusOfProblem(file, row.id, row.groups);
}

export function statusMap(
  bank: PracticeBank,
  file: ProgressFile,
  rows: readonly BankRow[],
): Map<string, MasteryState> {
  return new Map(rows.map((row) => [row.id, rowState(bank, file, row)]));
}

/* -------------------------------------------------------------------------- */
/* Matching and counting                                                       */
/* -------------------------------------------------------------------------- */

type Facet = 'level' | 'groups' | 'tags' | 'points' | 'status' | 'figure';

function passes(
  row: BankRow,
  filters: BankFilters,
  statuses: ReadonlyMap<string, MasteryState>,
  skip: ReadonlySet<Facet> = new Set(),
): boolean {
  if (!skip.has('level') && filters.level !== 'all' && !row.levels.includes(filters.level))
    return false;
  if (!skip.has('groups') && filters.groups.length > 0) {
    if (!row.groups.some((group) => filters.groups.includes(group))) return false;
  }
  if (!skip.has('tags') && filters.tags.length > 0) {
    if (!row.tags.some((tag) => filters.tags.includes(tag))) return false;
  }
  if (!skip.has('points') && filters.points.length > 0 && !filters.points.includes(row.points))
    return false;
  if (!skip.has('status') && filters.status.length > 0) {
    const bucket = bucketOf(statuses.get(row.id) ?? 'unseen');
    if (!filters.status.includes(bucket)) return false;
  }
  if (!skip.has('figure') && filters.figure && !row.hasFigure) return false;
  return true;
}

export function filterRows(
  rows: readonly BankRow[],
  filters: BankFilters,
  statuses: ReadonlyMap<string, MasteryState>,
): BankRow[] {
  return rows.filter((row) => passes(row, filters, statuses));
}

export interface SolvedCount {
  solved: number;
  total: number;
}

/**
 * Per-group solved / total for the filter panel. Counted within the selected level only, so a
 * skill's numbers do not jump around while the student ticks other boxes, but do answer "how
 * much of this is there at my level".
 */
export function groupCounts(
  rows: readonly BankRow[],
  filters: BankFilters,
  statuses: ReadonlyMap<string, MasteryState>,
): Map<string, SolvedCount> {
  const counts = new Map<string, SolvedCount>();
  for (const row of rows) {
    if (filters.level !== 'all' && !row.levels.includes(filters.level)) continue;
    const solved = bucketOf(statuses.get(row.id) ?? 'unseen') === 'solved';
    for (const group of new Set(row.groups)) {
      const entry = counts.get(group) ?? { solved: 0, total: 0 };
      entry.total += 1;
      if (solved) entry.solved += 1;
      counts.set(group, entry);
    }
  }
  return counts;
}

/** Solved / total for a whole section: rows tagged with ANY of its groups, each counted once. */
export function sectionCount(
  rows: readonly BankRow[],
  groupIds: readonly string[],
  filters: BankFilters,
  statuses: ReadonlyMap<string, MasteryState>,
): SolvedCount {
  const wanted = new Set(groupIds);
  let solved = 0;
  let total = 0;
  for (const row of rows) {
    if (filters.level !== 'all' && !row.levels.includes(filters.level)) continue;
    if (!row.groups.some((group) => wanted.has(group))) continue;
    total += 1;
    if (bucketOf(statuses.get(row.id) ?? 'unseen') === 'solved') solved += 1;
  }
  return { solved, total };
}

/** How many rows each option of a single facet would match, holding every other filter. */
export function facetCount<T>(
  rows: readonly BankRow[],
  filters: BankFilters,
  statuses: ReadonlyMap<string, MasteryState>,
  facet: Facet,
  test: (row: BankRow, value: T) => boolean,
  values: readonly T[],
): Map<T, number> {
  const base = rows.filter((row) => passes(row, filters, statuses, new Set([facet])));
  return new Map(values.map((value) => [value, base.filter((row) => test(row, value)).length]));
}

export function countBy(
  rows: readonly BankRow[],
  statuses: ReadonlyMap<string, MasteryState>,
): { solved: number; attempted: number; total: number } {
  let solved = 0;
  let attempted = 0;
  for (const row of rows) {
    const bucket = bucketOf(statuses.get(row.id) ?? 'unseen');
    if (bucket === 'solved') solved += 1;
    else if (bucket === 'attempted') attempted += 1;
  }
  return { solved, attempted, total: rows.length };
}

export function isFiltered(filters: BankFilters): boolean {
  return (
    filters.level !== 'all' ||
    filters.groups.length > 0 ||
    filters.tags.length > 0 ||
    filters.points.length > 0 ||
    filters.status.length > 0 ||
    filters.figure
  );
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/* -------------------------------------------------------------------------- */
/* Picking a set                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The ids for "Start practice": the selection in list order, unsolved first (to do, then
 * attempted, then solved), cut to `max`. A student who has cleared half a skill should be
 * handed the other half, not the problems they already know.
 */
export function practiceIds(
  rows: readonly BankRow[],
  statuses: ReadonlyMap<string, MasteryState>,
  max: number,
): string[] {
  const rank: Record<StatusBucket, number> = { todo: 0, attempted: 1, solved: 2 };
  return rows
    .map((row, index) => ({ row, index, rank: rank[bucketOf(statuses.get(row.id) ?? 'unseen')] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, max)
    .map((entry) => entry.row.id);
}

/** A random not-yet-solved row: to do first, then attempted. Null when everything is solved. */
export function randomUnsolved(
  rows: readonly BankRow[],
  statuses: ReadonlyMap<string, MasteryState>,
  random: () => number = Math.random,
): BankRow | null {
  const of = (bucket: StatusBucket) =>
    rows.filter((row) => bucketOf(statuses.get(row.id) ?? 'unseen') === bucket);
  const todo = of('todo');
  const pool = todo.length > 0 ? todo : of('attempted');
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? null;
}

/* -------------------------------------------------------------------------- */
/* URL mirroring                                                               */
/* -------------------------------------------------------------------------- */

const STATUS_VALUES = new Set<string>(['todo', 'attempted', 'solved']);

function listParam(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Total: unknown values are dropped, never thrown on. */
export function parseBankFilters(search: string, taxonomy: BankTaxonomy): BankFilters {
  const params = new URLSearchParams(search);
  const levels = new Set(taxonomy.level.options.map((option) => option.value));
  const groups = new Set(
    taxonomy.sections.items.flatMap((section) => section.groups.map((g) => g.id)),
  );
  const tags = new Set(taxonomy.tags?.items.map((tag) => tag.id) ?? []);
  const points = new Set<number>(taxonomy.difficulty.options.map((option) => option.points));
  // `band` and `strand` are the v2 bank's keys; links written before v3 still land correctly.
  const level = params.get('level') ?? params.get('band') ?? 'all';
  const legacySections = new Set(listParam(params, 'strand'));
  const fromSections = taxonomy.sections.items
    .filter((section) => legacySections.has(section.id))
    .flatMap((section) => section.groups.map((group) => group.id));
  const page = Number(params.get('page') ?? '1');
  return {
    level: levels.has(level) ? level : 'all',
    groups: [
      ...new Set([
        ...listParam(params, taxonomy.params.group).filter((g) => groups.has(g)),
        ...fromSections,
      ]),
    ],
    tags: [...new Set(listParam(params, taxonomy.params.tag).filter((t) => tags.has(t)))],
    points: [
      ...new Set(
        listParam(params, 'points')
          .map(Number)
          .filter((p): p is Points => points.has(p)),
      ),
    ],
    status: [
      ...new Set(
        listParam(params, 'status').filter((s): s is StatusBucket => STATUS_VALUES.has(s)),
      ),
    ],
    figure: params.get('figure') === '1',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Sorted values, so one selection is always one URL whatever order it was clicked in. */
export function bankFiltersToSearch(filters: BankFilters, taxonomy: BankTaxonomy): string {
  const params = new URLSearchParams();
  if (filters.level !== 'all') params.set('level', filters.level);
  if (filters.groups.length > 0)
    params.set(taxonomy.params.group, [...filters.groups].sort().join(','));
  if (filters.tags.length > 0) params.set(taxonomy.params.tag, [...filters.tags].sort().join(','));
  if (filters.points.length > 0)
    params.set('points', [...filters.points].sort((a, b) => a - b).join(','));
  if (filters.status.length > 0) {
    const order = STATUS_OPTIONS.map((option) => option.value);
    params.set(
      'status',
      [...filters.status].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(','),
    );
  }
  if (filters.figure) params.set('figure', '1');
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : '';
}

/* -------------------------------------------------------------------------- */
/* Kangaroo adapter                                                            */
/* -------------------------------------------------------------------------- */

export function kaBankTaxonomy(lookups: KaLookups): BankTaxonomy {
  return {
    bank: 'ka',
    noun: 'problem',
    level: {
      label: 'Level',
      options: [
        { value: 'all', label: 'All', ariaLabel: 'All levels' },
        ...lookups.bands.map((band) => ({
          value: band,
          label: band,
          ariaLabel: kaLevelLabel(band),
        })),
      ],
    },
    sections: {
      label: 'Skills',
      items: lookups.strands.map((strand) => ({
        id: strand.id,
        name: strand.name,
        groups: strand.skills.map((skill) => ({ id: skill.id, name: skill.name })),
      })),
    },
    tags: null,
    difficulty: {
      label: 'Difficulty',
      options: [
        { points: 3, label: '3 points', description: 'One step from a skill you know' },
        { points: 4, label: '4 points', description: 'Two steps, or one plus a trap' },
        { points: 5, label: '5 points', description: 'Needs an idea, not a procedure' },
      ],
    },
    params: { group: 'skill', tag: 'type' },
  };
}

/** id -> name for every group (skill or topic) in a taxonomy. */
export function taxonomyGroupNames(taxonomy: BankTaxonomy): Map<string, string> {
  return new Map(
    taxonomy.sections.items.flatMap((section) => section.groups.map((g) => [g.id, g.name])),
  );
}

export function kaBankRows(index: KaIndexFile, names: ReadonlyMap<string, string>): BankRow[] {
  return index.rows.map((row) => ({
    id: row.id,
    href: `/problem/${row.id}`,
    statement: row.statement,
    math: false,
    points: row.points,
    tierLabel: null,
    levels: [row.band],
    levelLabel: kaLevelLabel(row.band),
    section: row.strand,
    groups: [row.primary, ...row.secondary],
    primaryName: names.get(row.primary) ?? null,
    tags: [],
    hasFigure: row.hasFigure,
  }));
}

/* -------------------------------------------------------------------------- */
/* AMC adapter                                                                 */
/* -------------------------------------------------------------------------- */

export function amcBankTaxonomy(lookups: AmcLookups): BankTaxonomy {
  return {
    bank: 'amc',
    noun: 'problem',
    level: {
      label: 'Contest',
      options: [
        { value: 'all', label: 'Both', ariaLabel: 'AMC 10 and AMC 12' },
        { value: 'AMC10', label: 'AMC 10' },
        { value: 'AMC12', label: 'AMC 12' },
      ],
    },
    sections: {
      label: 'Topics',
      items: lookups.areas.map((area) => ({
        id: area.id,
        name: area.name,
        groups: area.topics.map((topic) => ({ id: topic.id, name: topic.name })),
      })),
    },
    tags: { label: 'Problem types', items: lookups.types },
    difficulty: {
      label: 'Tier',
      options: AMC_TIERS.map((tier) => ({
        points: AMC_TIER_POINTS[tier],
        label: tier,
        description: `Slots ${AMC_TIER_SLOTS[tier][0]}-${AMC_TIER_SLOTS[tier][1]}`,
      })),
    },
    params: { group: 'topic', tag: 'type' },
  };
}

export function amcBankRows(index: AmcIndexFile, names: ReadonlyMap<string, string>): BankRow[] {
  return index.rows.map((row) => ({
    id: row.id,
    href: `/amc/problem/${row.id}`,
    statement: row.statement,
    math: true,
    points: AMC_TIER_POINTS[row.tier],
    tierLabel: row.tier,
    levels: row.contest === 'BOTH' ? ['AMC10', 'AMC12'] : [row.contest],
    levelLabel: amcContestLabel(row.contest),
    section: row.area,
    groups: [row.topic],
    primaryName: names.get(row.topic) ?? null,
    tags: row.types,
    hasFigure: row.hasFigure,
  }));
}

/** Index file -> rows, for whichever bank. Names come from the taxonomy the page was given. */
export function bankRowsFromIndex(
  taxonomy: BankTaxonomy,
  index: KaIndexFile | AmcIndexFile,
): BankRow[] {
  const names = taxonomyGroupNames(taxonomy);
  return taxonomy.bank === 'amc'
    ? amcBankRows(index as AmcIndexFile, names)
    : kaBankRows(index as KaIndexFile, names);
}
