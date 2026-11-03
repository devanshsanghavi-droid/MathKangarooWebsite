/**
 * The two rules that ARE the product, in one place.
 *
 *   - every incorrect choice carries a written misconception;
 *   - every figure carries author-written alt text.
 *
 * They live here, with no filesystem and no Node imports, because three different callers need
 * them and they must never drift apart:
 *
 *   1. `scripts/lib/content-rules.ts`, which is what CI fails the build on;
 *   2. `src/lib/author.ts`, so the authoring form cannot call a draft valid that CI rejects;
 *   3. the Zod schema, which expresses them again as types.
 *
 * Before this was shared, the form used only the Zod schema - and the schema permits
 * `misconception: string | null` on any choice, because the "required exactly when the choice
 * is wrong" half is a cross-field rule. The form therefore accepted a problem that
 * `pnpm validate:content` would reject, which is precisely the guarantee M2.13 is supposed to
 * make.
 */

export type ProblemRuleId =
  | 'problem/misconception-required'
  | 'problem/correct-choice-no-misconception'
  | 'problem/figure-alt-required';

export interface ProblemRuleViolation {
  rule: ProblemRuleId;
  /** Dotted path into the JSON, so a form can point at the field. */
  path: string;
  message: string;
}

/** The shortest a misconception can be and still say what the student was thinking. */
export const MIN_MISCONCEPTION = 30;
/** The shortest alt text that can describe what a solver extracts from a figure. */
export const MIN_FIGURE_ALT = 20;

/**
 * Checks the raw JSON, before any schema parse, so the message an author reads explains why the
 * field exists rather than saying "string too short".
 */
export function checkProblemRules(value: unknown): ProblemRuleViolation[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const violations: ProblemRuleViolation[] = [];

  const choices = record.choices;
  if (Array.isArray(choices)) {
    choices.forEach((entry, index) => {
      if (typeof entry !== 'object' || entry === null) return;
      const choice = entry as Record<string, unknown>;
      const key = typeof choice.key === 'string' ? choice.key : String(index);
      const isCorrect = choice.correct === true;
      const misconception = choice.misconception;
      const text = typeof misconception === 'string' ? misconception.trim() : '';

      if (!isCorrect && text.length === 0) {
        violations.push({
          rule: 'problem/misconception-required',
          path: `choices.${index}.misconception`,
          message:
            `Choice ${key} is incorrect and has no misconception. Distractor-specific feedback ` +
            'is the product: write the student thinking that produces this answer, in the ' +
            "student's own voice.",
        });
      } else if (!isCorrect && text.length < MIN_MISCONCEPTION) {
        violations.push({
          rule: 'problem/misconception-required',
          path: `choices.${index}.misconception`,
          message:
            `Choice ${key}'s misconception is ${text.length} characters. It needs at least ` +
            `${MIN_MISCONCEPTION} - enough to name the mistake, not just label it.`,
        });
      }

      if (isCorrect && misconception !== null && misconception !== undefined && text.length > 0) {
        violations.push({
          rule: 'problem/correct-choice-no-misconception',
          path: `choices.${index}.misconception`,
          message: `Choice ${key} is correct, so its misconception must be null.`,
        });
      }
    });
  }

  const figure = record.figure;
  if (figure && typeof figure === 'object') {
    const alt = (figure as Record<string, unknown>).alt;
    const text = typeof alt === 'string' ? alt.trim() : '';
    if (text.length < MIN_FIGURE_ALT) {
      violations.push({
        rule: 'problem/figure-alt-required',
        path: 'figure.alt',
        message:
          'The figure has no usable alt text. Describe what a sighted solver EXTRACTS from it, ' +
          'not what it looks like.',
      });
    }
  }

  return violations;
}
