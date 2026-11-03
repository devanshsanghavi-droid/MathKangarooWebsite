import { CHOICE_KEYS, type ChoiceKey } from '../schemas';

/**
 * Classical item analysis, applied to the problem bank.
 *
 * Four statistics, and one of them is the reason this file exists.
 *
 *   p-value          proportion who got it right. Difficulty, measured rather than declared.
 *   discrimination   how much better the strong students did than the weak ones on this item.
 *   point-biserial   the same idea as a correlation, computed PER OPTION.
 *   efficiency       how many distractors are doing any work at all.
 *
 * The per-option point-biserial is the interesting one. Correlate "chose option C" with the
 * student's total score, and the sign tells you what C is doing:
 *
 *   negative   weaker students pick it - the distractor is working as designed
 *   near zero  nobody's ability predicts picking it - it is noise, or a guess magnet
 *   POSITIVE   STRONGER students pick it, which means one of two things, both worth knowing:
 *              the item is flawed and C is arguably defensible, or C is a genuinely subtle
 *              trap that catches people precisely because they know enough to fall for it.
 *
 * On a site whose entire thesis is that every wrong answer stores the misconception producing
 * it, a positively-correlated distractor is the highest-value signal available: it is a
 * misconception that survives competence, which is exactly the kind worth teaching against.
 *
 * Everything here is pure. It takes response records and returns numbers; it never reads a
 * database, a clock or a request. That is what lets it be tested to the decimal, and what
 * lets the same code run over a live table later and over a fixture today.
 */

/** docs/01-DATA-MODEL.md §4: nothing published is derived from fewer than ten students. */
export const PUBLISH_MIN_N = 10;
/** docs/02-BUILD-PLAN.md M3.3: difficulty is only recalibrated once an item has this many. */
export const CALIBRATION_MIN_N = 30;
/** A distractor chosen by fewer than this share of students is doing no work. */
export const NON_FUNCTIONING_THRESHOLD = 0.05;
/** The classic upper/lower split for the discrimination index. */
export const DISCRIMINATION_GROUP_FRACTION = 0.27;

export interface ItemResponse {
  problemId: string;
  choiceKey: ChoiceKey;
  correct: boolean;
}

/** One anonymous respondent's whole sitting. `respondent` is a session token, never a name. */
export interface RespondentRecord {
  respondent: string;
  responses: readonly ItemResponse[];
}

export interface OptionStats {
  key: ChoiceKey;
  /** How many chose it, and what share of responses that is. */
  count: number;
  share: number;
  /** Correlation between choosing this option and total score. Null when undefined. */
  pointBiserial: number | null;
  isCorrectOption: boolean;
  /** A distractor almost nobody picks. Dead weight in the item. */
  nonFunctioning: boolean;
  /**
   * A DISTRACTOR that stronger students pick more than weaker ones. Either the item is flawed
   * or the misconception behind it survives competence. Both deserve an author's attention.
   */
  attractsStrongStudents: boolean;
}

export interface ItemStats {
  problemId: string;
  n: number;
  /** Proportion correct. 1 is trivial, 0 is impossible. */
  pValue: number;
  /** Upper group's success rate minus the lower group's. Above ~0.2 is healthy. */
  discrimination: number | null;
  /** Point-biserial of the correct option. Should be clearly positive. */
  discriminationRpb: number | null;
  /** Share of distractors that at least NON_FUNCTIONING_THRESHOLD of students chose. */
  distractorEfficiency: number;
  options: OptionStats[];
  /** Set when the item is worth a human look, with the reasons spelled out. */
  flags: string[];
}

/** Population standard deviation. Sample SD would understate r_pb on small cohorts. */
function populationSd(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Point-biserial correlation between a binary indicator and a continuous score.
 *
 *   r_pb = (M1 - M0) / Sn * sqrt(p * q)
 *
 * Null when it is genuinely undefined rather than zero: nobody (or everybody) has the
 * indicator, or every total score is identical so there is no variance to correlate against.
 * Returning 0 in those cases would quietly claim "no relationship" where the honest answer is
 * "this cannot be computed from what we have".
 */
export function pointBiserial(
  indicator: readonly boolean[],
  scores: readonly number[],
): number | null {
  if (indicator.length !== scores.length || indicator.length === 0) return null;
  const withIndicator = scores.filter((_score, index) => indicator[index]);
  const without = scores.filter((_score, index) => !indicator[index]);
  if (withIndicator.length === 0 || without.length === 0) return null;

  const sd = populationSd(scores);
  if (sd === 0) return null;

  const p = withIndicator.length / indicator.length;
  const q = 1 - p;
  return ((mean(withIndicator) - mean(without)) / sd) * Math.sqrt(p * q);
}

/**
 * Discrimination index: success rate in the top group minus the bottom group, split at 27% of
 * the cohort - the split that maximises the statistic's stability for normally distributed
 * ability, and the one classical item analysis has used since Kelley.
 */
export function discriminationIndex(
  gotItRight: readonly boolean[],
  totals: readonly number[],
  fraction = DISCRIMINATION_GROUP_FRACTION,
): number | null {
  const n = gotItRight.length;
  if (n !== totals.length || n < 4) return null;
  const groupSize = Math.max(1, Math.floor(n * fraction));

  const ordered = totals
    .map((total, index) => ({ total, right: gotItRight[index] === true }))
    .sort((a, b) => b.total - a.total);

  const upper = ordered.slice(0, groupSize);
  const lower = ordered.slice(-groupSize);
  if (upper.length === 0 || lower.length === 0) return null;

  const rate = (group: typeof upper) => group.filter((entry) => entry.right).length / group.length;
  return rate(upper) - rate(lower);
}

/**
 * Analyse every item a cohort answered.
 *
 * `correctKeyFor` comes from the content files rather than from the responses: an item whose
 * answer key nobody has hit yet still has a correct option, and inferring the key from what
 * students picked would make a badly-worded item look correct by majority vote.
 */
export function analyseItems(
  records: readonly RespondentRecord[],
  correctKeyFor: (problemId: string) => ChoiceKey | undefined,
  minN = PUBLISH_MIN_N,
): ItemStats[] {
  // Total score per respondent: how many they got right across everything they answered.
  const totalByRespondent = new Map<string, number>();
  for (const record of records) {
    totalByRespondent.set(
      record.respondent,
      record.responses.filter((response) => response.correct).length,
    );
  }

  const byProblem = new Map<string, Array<{ respondent: string; response: ItemResponse }>>();
  for (const record of records) {
    for (const response of record.responses) {
      const list = byProblem.get(response.problemId) ?? [];
      list.push({ respondent: record.respondent, response });
      byProblem.set(response.problemId, list);
    }
  }

  const out: ItemStats[] = [];

  for (const [problemId, entries] of byProblem) {
    const n = entries.length;
    if (n < minN) continue;

    const totals = entries.map((entry) => totalByRespondent.get(entry.respondent) ?? 0);
    const rights = entries.map((entry) => entry.response.correct);
    const pValue = rights.filter(Boolean).length / n;
    const correctKey = correctKeyFor(problemId);

    const options: OptionStats[] = CHOICE_KEYS.map((key) => {
      const chose = entries.map((entry) => entry.response.choiceKey === key);
      const count = chose.filter(Boolean).length;
      const share = count / n;
      const rpb = pointBiserial(chose, totals);
      const isCorrectOption = key === correctKey;
      return {
        key,
        count,
        share,
        pointBiserial: rpb,
        isCorrectOption,
        nonFunctioning: !isCorrectOption && share < NON_FUNCTIONING_THRESHOLD,
        attractsStrongStudents: !isCorrectOption && rpb !== null && rpb > 0,
      };
    });

    const distractors = options.filter((option) => !option.isCorrectOption);
    const working = distractors.filter((option) => !option.nonFunctioning).length;
    const correctOption = options.find((option) => option.isCorrectOption);

    const discrimination = discriminationIndex(rights, totals);
    const flags: string[] = [];
    if (pValue > 0.95) flags.push('too easy - nearly everyone gets it (p > 0.95)');
    if (pValue < 0.15) flags.push('too hard - almost nobody gets it (p < 0.15)');
    if (discrimination !== null && discrimination < 0.1) {
      flags.push('barely separates strong from weak students (D < 0.1)');
    }
    if (correctOption?.pointBiserial !== null && (correctOption?.pointBiserial ?? 0) < 0) {
      flags.push('the correct answer correlates NEGATIVELY with ability - check the key');
    }
    for (const option of distractors) {
      if (option.attractsStrongStudents) {
        flags.push(`${option.key} attracts stronger students - flawed item, or a subtle trap`);
      }
      if (option.nonFunctioning) {
        flags.push(`${option.key} is chosen by under 5% - the distractor is doing no work`);
      }
    }

    out.push({
      problemId,
      n,
      pValue,
      discrimination,
      discriminationRpb: correctOption?.pointBiserial ?? null,
      distractorEfficiency: distractors.length === 0 ? 0 : working / distractors.length,
      options,
      flags,
    });
  }

  return out.sort((a, b) => a.problemId.localeCompare(b.problemId));
}
