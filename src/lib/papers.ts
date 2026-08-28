import type { Band, PaperIndex, Points } from './schemas';
import { POINT_VALUES } from './schemas';

/**
 * Analysis over the paper index.
 *
 * Everything in `content/papers/` is OUR analysis of an official paper: a question number, a
 * point value, our skill tags, and an optional short characterisation in our own words. There
 * is no official problem text, no figure and no answer anywhere in it, and there never will be
 * — see CLAUDE.md's first non-negotiable and the 2KB tripwire in the content validator.
 *
 * These functions turn that analysis into the two things a student or tutor actually wants:
 * what a given paper tested, and which skills a band leans on most.
 */

export interface SkillFrequency {
  skillId: string;
  /** How many indexed questions tag this skill. */
  count: number;
  /** Share of all indexed questions in the set, 0–1. */
  share: number;
  /** Point values this skill has been tagged at, ascending. */
  points: readonly Points[];
}

export function paperTitle(paper: Pick<PaperIndex, 'year' | 'band'>): string {
  return `${paper.year}, level ${paper.band.replace('-', '–')}`;
}

export function paperSlug(paper: Pick<PaperIndex, 'year' | 'band'>): string {
  return `${paper.year}-${paper.band}`;
}

/** Split a slug like "2019-5-6" back into a year and a band. Total: returns null on nonsense. */
export function parsePaperSlug(slug: string): { year: number; band: Band } | null {
  const match = /^(\d{4})-(\d{1,2}-\d{1,2})$/.exec(slug);
  if (!match) return null;
  const year = Number(match[1]);
  const band = match[2] as Band;
  if (!Number.isInteger(year)) return null;
  return { year, band };
}

/** How many questions sit at each point value. Kangaroo papers run in exact thirds. */
export function pointDistribution(paper: PaperIndex): Map<Points, number> {
  const counts = new Map<Points, number>(POINT_VALUES.map((points) => [points, 0]));
  for (const question of paper.questions) {
    counts.set(question.points, (counts.get(question.points) ?? 0) + 1);
  }
  return counts;
}

/**
 * The skills a set of papers tests most, commonest first.
 *
 * A question tagged with two skills counts once for each, so the counts add to more than the
 * number of questions — which is the honest thing to report, because a question really does
 * test both. `share` is therefore a share of questions, not a share of a whole.
 */
export function mostTestedSkills(papers: readonly PaperIndex[], limit?: number): SkillFrequency[] {
  const questionCount = papers.reduce((total, paper) => total + paper.questions.length, 0);
  if (questionCount === 0) return [];

  const counts = new Map<string, { count: number; points: Set<Points> }>();
  for (const paper of papers) {
    for (const question of paper.questions) {
      for (const skillId of question.skills) {
        const entry = counts.get(skillId) ?? { count: 0, points: new Set<Points>() };
        entry.count += 1;
        entry.points.add(question.points);
        counts.set(skillId, entry);
      }
    }
  }

  const frequencies = [...counts.entries()]
    .map(([skillId, entry]) => ({
      skillId,
      count: entry.count,
      share: entry.count / questionCount,
      points: [...entry.points].sort((a, b) => a - b),
    }))
    // Commonest first; ties broken on id so the chart is stable across builds.
    .sort((a, b) => b.count - a.count || a.skillId.localeCompare(b.skillId));

  return limit === undefined ? frequencies : frequencies.slice(0, limit);
}

/** Group the indexed papers by band, newest year first within each. */
export function papersByBand(papers: readonly PaperIndex[]): Map<Band, PaperIndex[]> {
  const grouped = new Map<Band, PaperIndex[]>();
  for (const paper of papers) {
    const bucket = grouped.get(paper.band);
    if (bucket) bucket.push(paper);
    else grouped.set(paper.band, [paper]);
  }
  for (const list of grouped.values()) list.sort((a, b) => b.year - a.year);
  return grouped;
}

/**
 * The official paper structure, which is public fact rather than analysis: bands 1–2 and 3–4
 * sit 24 questions for 96 points, everything above sits 30 for 120, in exact thirds at 3, 4
 * and 5 points. Used to say whether an index is complete.
 */
export function expectedQuestionCount(band: Band): number {
  return band === '1-2' || band === '3-4' ? 24 : 30;
}

export function isComplete(paper: PaperIndex): boolean {
  return paper.questions.length === expectedQuestionCount(paper.band);
}
