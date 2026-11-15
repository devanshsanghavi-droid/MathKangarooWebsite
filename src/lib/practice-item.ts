import type { Band, Choice, Figure, Points, Problem } from './schemas.ts';
import type { AmcContest, AmcProblem } from './amc-schemas.ts';
import { AMC_PROBLEM_ID_RE, AMC_TIER_SLOTS, amcPointsOf, amcTierOf } from './amc-tier.ts';

/**
 * One question as the practice engine sees it, whichever bank it came from.
 *
 * `<PracticeSession>` (docs/06 §4) runs Kangaroo sets, AMC sets, `/problem/[id]` and the AMC
 * problem page. The two banks store different shapes - Kangaroo tags skills and a band, AMC
 * tags an area, a topic, problem types and a paper slot - so each is adapted ONCE into this
 * shape and the engine never branches on the bank except to record the attempt.
 *
 * This is also the exact format of `public/data/p/<ID>.json`: scripts/build-static-data.ts
 * runs the adapters below at build time, so a practice set fetches ready-to-render items and
 * needs no lookup tables. The server-rendered problem pages run the same adapters, so a
 * prerendered page and a fetched one can never disagree.
 *
 * Pure and dependency-free (type imports only, plus the tiny amc-tier module), so the build
 * script can import it under plain Node and client components can import it without pulling
 * in Zod or the filesystem.
 */

export type PracticeBank = 'ka' | 'amc';

/** A label the end-of-set breakdown groups by: a Kangaroo skill or an AMC topic. */
export interface PracticeGroup {
  id: string;
  name: string;
}

export interface PracticeItemBase {
  id: string;
  /** The question's own page. */
  href: string;
  statement: string;
  /** True when statement, choices, hints and solutions carry KaTeX in `$...$` (AMC). */
  math: boolean;
  figure: Figure | null;
  choices: Choice[];
  hints: [string, string, string];
  solutions: { reliable: string; elegant: string | null };
  /** Kangaroo only. AMC problems have no whyOnTest field. */
  whyOnTest: string | null;
  /** Difficulty tier as 3 / 4 / 5, which is also what the progress store records. */
  points: Points;
  /** Shown instead of "N pt" when the bank names its tiers (AMC "Early"). Null for Kangaroo. */
  tierLabel: string | null;
  estSeconds: number;
  /** Primary first. The end-of-set breakdown uses the first one. */
  groups: PracticeGroup[];
  /** "Level 3-4", "AMC 10", "AMC 10 and 12". */
  levelLabel: string;
}

export interface KaPracticeItem extends PracticeItemBase {
  bank: 'ka';
  band: Band;
  /** Primary then secondary skill ids: the attempt is stored against every one. */
  skillIds: string[];
}

export interface AmcPracticeItem extends PracticeItemBase {
  bank: 'amc';
  contest: AmcContest;
  slot: number;
  area: string;
  topic: string;
  types: string[];
  formulas: string[];
}

export type PracticeItem = KaPracticeItem | AmcPracticeItem;

/** Plain hyphen: no en or em dashes anywhere in copy. */
export function kaLevelLabel(band: Band): string {
  return `Level ${band}`;
}

export function amcContestLabel(contest: AmcContest): string {
  if (contest === 'BOTH') return 'AMC 10 and 12';
  return contest === 'AMC10' ? 'AMC 10' : 'AMC 12';
}

export function amcTierLabel(slot: number): string {
  const tier = amcTierOf(slot);
  const [from, to] = AMC_TIER_SLOTS[tier];
  return `${tier} (slots ${from}-${to})`;
}

/**
 * Kangaroo problem -> practice item. `skillName` resolves ids to names; an unknown id keeps
 * the id as its name rather than dropping the group, so the breakdown never loses a question.
 */
export function kaPracticeItem(
  problem: Problem,
  skillName: (id: string) => string | undefined,
): KaPracticeItem {
  const skillIds = [problem.skills.primary, ...problem.skills.secondary];
  return {
    bank: 'ka',
    id: problem.id,
    href: `/problem/${problem.id}`,
    statement: problem.statement,
    math: false,
    figure: problem.figure,
    choices: problem.choices,
    hints: problem.hints,
    solutions: problem.solutions,
    whyOnTest: problem.whyOnTest,
    points: problem.points,
    tierLabel: null,
    estSeconds: problem.estSeconds,
    groups: skillIds.map((id) => ({ id, name: skillName(id) ?? id })),
    levelLabel: kaLevelLabel(problem.band),
    band: problem.band,
    skillIds,
  };
}

/** AMC problem -> practice item. `topicName` resolves the topic id from the AMC taxonomy. */
export function amcPracticeItem(
  problem: AmcProblem,
  topicName: (id: string) => string | undefined,
): AmcPracticeItem {
  return {
    bank: 'amc',
    id: problem.id,
    href: `/amc/problem/${problem.id}`,
    statement: problem.statement,
    math: true,
    figure: problem.figure,
    choices: problem.choices,
    hints: problem.hints,
    solutions: problem.solutions,
    whyOnTest: null,
    points: amcPointsOf(problem.slot),
    tierLabel: amcTierLabel(problem.slot),
    estSeconds: problem.estSeconds,
    groups: [{ id: problem.topic, name: topicName(problem.topic) ?? problem.topic }],
    levelLabel: amcContestLabel(problem.contest),
    contest: problem.contest,
    slot: problem.slot,
    area: problem.area,
    topic: problem.topic,
    types: problem.types,
    formulas: problem.formulas,
  };
}

/* -------------------------------------------------------------------------- */
/* /practice/set URL                                                           */
/* -------------------------------------------------------------------------- */

/** A set longer than this is a test, not practice, and its URL stops being shareable. */
export const PRACTICE_SET_MAX = 20;
/** The hard cap on ids read back from a URL, so a pasted link cannot ask for a thousand files. */
export const PRACTICE_SET_URL_MAX = 50;

const KA_ID_RE = /^KA-\d{4}$/;

export function isPracticeId(bank: PracticeBank, id: string): boolean {
  return bank === 'amc' ? AMC_PROBLEM_ID_RE.test(id) : KA_ID_RE.test(id);
}

export interface PracticeSetQuery {
  bank: PracticeBank;
  ids: string[];
  /** Optional set name, e.g. "Review missed". Plain text, capped. */
  name: string;
}

export function parsePracticeSetQuery(search: string | URLSearchParams): PracticeSetQuery {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const bank: PracticeBank = params.get('bank') === 'amc' ? 'amc' : 'ka';
  const ids = [
    ...new Set(
      params
        .getAll('ids')
        .flatMap((value) => value.split(','))
        .map((value) => value.trim().toUpperCase())
        .filter((value) => isPracticeId(bank, value)),
    ),
  ].slice(0, PRACTICE_SET_URL_MAX);
  const name = (params.get('name') ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { bank, ids, name };
}

export function practiceSetHref({
  bank = 'ka',
  ids,
  name,
}: {
  bank?: PracticeBank;
  ids: readonly string[];
  name?: string;
}): string {
  const params = new URLSearchParams();
  if (bank === 'amc') params.set('bank', 'amc');
  params.set('ids', ids.join(','));
  if (name) params.set('name', name);
  // Commas are safe in a query value and keep the link readable when it is pasted. An AMC set
  // runs at /amc/practice, the same loader under the AMC layout, so it carries the MAA notice;
  // `bank=amc` stays in the query so the loader needs no second code path.
  const path = bank === 'amc' ? '/amc/practice' : '/practice/set';
  return `${path}?${params.toString().replace(/%2C/g, ',')}`;
}
