import type { Formula } from '@/lib/amc-schemas';
import { MathText, renderMath } from '@/components/MathText';
import { Badge, cx } from '@/components/ui';

export const PRIORITY_LABEL: Record<Formula['priority'], string> = {
  'must-know': 'Must-know',
  'good-to-know': 'Good to know',
};

export function formulaContestLabel(contests: readonly string[]): string {
  if (contests.includes('AMC10') && contests.includes('AMC12')) return 'AMC 10 and 12';
  return contests.includes('AMC12') ? 'AMC 12' : 'AMC 10';
}

/**
 * One formula from the AMC formula sheet (docs/06 §5): its name, the formula typeset in
 * display mode, when to use it, a worked example, the usual pitfall and, folded away, why it
 * is true. Server-safe: KaTeX renders to a string here, so a page made of these cards ships no
 * KaTeX JavaScript.
 *
 * `compact` keeps the name, the formula and when to use it, for the sidebar of a problem type
 * or a problem. The card's id is the formula id, so `/amc/formulas#F-ALG-01` lands on it.
 */
export function FormulaCard({
  formula,
  compact = false,
  headingLevel = 3,
  anchor = false,
  className,
}: {
  formula: Formula;
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** Give the card the formula id as its element id (the sheet does; sidebars do not). */
  anchor?: boolean;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      {...(anchor ? { id: formula.id } : {})}
      className={cx(
        'formula-card scroll-mt-24 rounded-card border border-rule bg-surface p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="m-0 text-base font-semibold text-ink">{formula.name}</Heading>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={formula.priority === 'must-know' ? 'accent' : 'neutral'}>
            {PRIORITY_LABEL[formula.priority]}
          </Badge>
          {compact ? null : <Badge tone="outline">{formulaContestLabel(formula.contests)}</Badge>}
        </div>
      </div>
      {/*
        Long display formulas scroll sideways inside this box, so the box takes focus: a keyboard
        user can then scroll it with the arrow keys (WCAG 2.1.1). The region is named for that.
      */}
      <div
        role="region"
        aria-label={`${formula.name}: the formula`}
        tabIndex={0}
        className="my-3 overflow-x-auto rounded-control bg-surface-2 px-3 py-2 text-ink"
        // Rendered by KaTeX from our own reviewed content files, never from user input.
        dangerouslySetInnerHTML={{ __html: renderMath(formula.formula, true) }}
      />
      <p className="m-0 text-sm text-ink">
        <span className="ui font-semibold">When to use it. </span>
        <MathText text={formula.whenToUse} />
      </p>
      {compact ? null : (
        <>
          <p className="m-0 mt-2 text-sm text-ink-2">
            <span className="ui font-semibold text-ink">Example. </span>
            <MathText text={formula.example} />
          </p>
          <p className="m-0 mt-2 text-sm text-ink-2">
            <span className="ui font-semibold text-ink">Pitfall. </span>
            <MathText text={formula.pitfall} />
          </p>
          {formula.derivation ? (
            <details className="mt-2 text-sm text-ink-2 print:hidden">
              <summary className="ui cursor-pointer text-xs font-semibold text-accent-700">
                Why it is true
              </summary>
              <p className="m-0 mt-2">
                <MathText text={formula.derivation} />
              </p>
            </details>
          ) : null}
        </>
      )}
    </article>
  );
}
