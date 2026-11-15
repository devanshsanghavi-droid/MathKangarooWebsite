import type { Band, Points, Problem, Skill, Strand, Tier } from './schemas.ts';
import type { AmcContest, AmcProblem, AmcTaxonomy } from './amc-schemas.ts';
import { amcTierOf, type AmcTier } from './amc-tier.ts';
import { STRAND_META } from './taxonomy-meta.ts';

/**
 * The static bank data (docs/06 §3), as types and pure builders.
 *
 * scripts/build-static-data.ts runs these over content/ at build time and writes the results
 * to the gitignored `public/data/`. Static assets cost nothing on the Workers free plan, so the
 * question bank, the practice engine and the worksheet builder read these files in the browser
 * instead of asking a worker to render a filtered page.
 *
 *   /data/ka-index.json     KaIndexFile   one light row per Kangaroo problem
 *   /data/ka-lookups.json   KaLookups     strands, their skills, names: what the filters need
 *   /data/amc-index.json    AmcIndexFile  one light row per AMC problem
 *   /data/amc-lookups.json  AmcLookups    areas, topics, problem types
 *   /data/p/<ID>.json       PracticeItem  the whole question, see practice-item.ts
 *
 * Every file carries `version`; bump STATIC_DATA_VERSION when a field changes meaning.
 */

export const STATIC_DATA_VERSION = 1;
export const DATA_BASE = '/data';
export const STATEMENT_PREVIEW_MAX = 220;

export const dataPaths = {
  kaIndex: `${DATA_BASE}/ka-index.json`,
  kaLookups: `${DATA_BASE}/ka-lookups.json`,
  amcIndex: `${DATA_BASE}/amc-index.json`,
  amcLookups: `${DATA_BASE}/amc-lookups.json`,
  problem: (id: string) => `${DATA_BASE}/p/${id}.json`,
} as const;

/* -------------------------------------------------------------------------- */
/* Kangaroo                                                                    */
/* -------------------------------------------------------------------------- */

export interface KaIndexRow {
  id: string;
  band: Band;
  points: Points;
  /** Plain text, cut to STATEMENT_PREVIEW_MAX characters at a word boundary. */
  statement: string;
  hasFigure: boolean;
  /** Primary skill id. */
  primary: string;
  secondary: string[];
  /** Strand of the primary skill. */
  strand: Strand;
}

export interface KaIndexFile {
  version: number;
  rows: KaIndexRow[];
}

export interface KaLookupSkill {
  id: string;
  name: string;
  tier: Tier;
}

export interface KaLookupStrand {
  id: Strand;
  name: string;
  /** Skills in Atlas order: foundation, core, gateway, then id. */
  skills: KaLookupSkill[];
}

export interface KaLookups {
  version: number;
  /** Problems in the bank. */
  total: number;
  /** Bands that hold at least one problem, in level order. */
  bands: Band[];
  strands: KaLookupStrand[];
}

const TIER_RANK: Record<Tier, number> = { foundation: 0, core: 1, gateway: 2 };
const STRAND_ORDER: readonly Strand[] = ['NUM', 'CNT', 'GEO', 'LOG', 'PAT', 'MOD', 'CFT'];
const BAND_ORDER: readonly Band[] = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'];

/** Cut at a word boundary and add an ellipsis. Plain text only; see `previewMath` for KaTeX. */
export function previewText(text: string, max = STATEMENT_PREVIEW_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

/**
 * The same, for text with `$...$` math: never cuts inside a formula, so the preview still
 * renders. A formula that straddles the limit is dropped whole along with what follows it.
 */
export function previewMath(text: string, max = STATEMENT_PREVIEW_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let inMath = false;
  let lastSafe = 0;
  for (let index = 0; index < clean.length && index < max; index += 1) {
    const char = clean[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '$') {
      inMath = !inMath;
      if (!inMath) lastSafe = index + 1;
      continue;
    }
    if (!inMath && char === ' ') lastSafe = index;
  }
  const cut = clean.slice(0, lastSafe).replace(/[\s,;:.]+$/, '');
  return `${cut}…`;
}

export function kaIndexRow(problem: Problem): KaIndexRow {
  return {
    id: problem.id,
    band: problem.band,
    points: problem.points,
    statement: previewText(problem.statement),
    hasFigure: problem.figure !== null,
    primary: problem.skills.primary,
    secondary: [...problem.skills.secondary],
    strand: problem.skills.primary.slice(0, 3) as Strand,
  };
}

export function buildKaIndex(problems: readonly Problem[]): KaIndexFile {
  return {
    version: STATIC_DATA_VERSION,
    rows: [...problems].sort((a, b) => a.id.localeCompare(b.id)).map(kaIndexRow),
  };
}

export function buildKaLookups(skills: readonly Skill[], problems: readonly Problem[]): KaLookups {
  const present = new Set(problems.map((problem) => problem.band));
  return {
    version: STATIC_DATA_VERSION,
    total: problems.length,
    bands: BAND_ORDER.filter((band) => present.has(band)),
    strands: STRAND_ORDER.map((strand) => ({
      id: strand,
      name: STRAND_META[strand].name,
      skills: skills
        .filter((skill) => skill.strand === strand)
        .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.id.localeCompare(b.id))
        .map((skill) => ({ id: skill.id, name: skill.name, tier: skill.tier })),
    })),
  };
}

/** id -> name over every skill in the lookups. */
export function kaSkillNames(lookups: KaLookups): Map<string, string> {
  return new Map(lookups.strands.flatMap((strand) => strand.skills.map((s) => [s.id, s.name])));
}

/* -------------------------------------------------------------------------- */
/* AMC                                                                         */
/* -------------------------------------------------------------------------- */

export interface AmcIndexRow {
  id: string;
  contest: AmcContest;
  slot: number;
  tier: AmcTier;
  area: string;
  topic: string;
  types: string[];
  /** KaTeX in `$...$`, cut to STATEMENT_PREVIEW_MAX without splitting a formula. */
  statement: string;
  hasFigure: boolean;
}

export interface AmcIndexFile {
  version: number;
  rows: AmcIndexRow[];
}

export interface AmcLookupTopic {
  id: string;
  name: string;
  amc12Only: boolean;
}

export interface AmcLookups {
  version: number;
  total: number;
  areas: Array<{ id: string; name: string; topics: AmcLookupTopic[] }>;
  types: Array<{ id: string; name: string }>;
}

export function amcIndexRow(problem: AmcProblem): AmcIndexRow {
  return {
    id: problem.id,
    contest: problem.contest,
    slot: problem.slot,
    tier: amcTierOf(problem.slot),
    area: problem.area,
    topic: problem.topic,
    types: [...problem.types],
    statement: previewMath(problem.statement),
    hasFigure: problem.figure !== null,
  };
}

export function buildAmcIndex(problems: readonly AmcProblem[]): AmcIndexFile {
  return {
    version: STATIC_DATA_VERSION,
    rows: [...problems].sort((a, b) => a.id.localeCompare(b.id)).map(amcIndexRow),
  };
}

export function buildAmcLookups(
  taxonomy: AmcTaxonomy,
  problems: readonly AmcProblem[],
): AmcLookups {
  return {
    version: STATIC_DATA_VERSION,
    total: problems.length,
    areas: taxonomy.areas.map((area) => ({
      id: area.id,
      name: area.name,
      topics: taxonomy.topics
        .filter((topic) => topic.area === area.id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((topic) => ({ id: topic.id, name: topic.name, amc12Only: topic.amc12Only })),
    })),
    types: [...taxonomy.types]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((type) => ({ id: type.id, name: type.name })),
  };
}

/** id -> name over every AMC topic. */
export function amcTopicNames(lookups: AmcLookups): Map<string, string> {
  return new Map(lookups.areas.flatMap((area) => area.topics.map((t) => [t.id, t.name])));
}
