import type { AmcFormulaContest, FormulaPriority } from './amc-schemas';

/**
 * The formula sheet's filter, pure so it can be tested without rendering. Used by the sheet
 * (/amc/formulas) and by the flashcards (/amc/formulas/drill), so "must-know only" means the
 * same set in both places.
 */

export type FormulaContestFilter = 'all' | AmcFormulaContest;

export interface FormulaFilterable {
  priority: FormulaPriority;
  contests: readonly AmcFormulaContest[];
}

export function filterFormulas<T extends FormulaFilterable>(
  items: readonly T[],
  { contest = 'all', mustOnly = false }: { contest?: FormulaContestFilter; mustOnly?: boolean },
): T[] {
  return items.filter(
    (item) =>
      (contest === 'all' || item.contests.includes(contest)) &&
      (!mustOnly || item.priority === 'must-know'),
  );
}
