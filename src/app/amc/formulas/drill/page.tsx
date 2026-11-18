import type { Metadata } from 'next';
import { getAmcFormulas, getAmcTaxonomy } from '@/lib/amc-content';
import { MathText, renderMath } from '@/components/MathText';
import { FormulaDrill, type DrillCard } from '@/components/amc/FormulaDrill';
import { BetaBadge, PageContainer, PageHeader } from '@/components/ui';

/**
 * `/amc/formulas/drill` - spaced-repetition flashcards over the formula sheet (docs/06 §5).
 *
 * Static. The faces are typeset here on the server and handed to the client component as
 * rendered elements, so the drill ships no KaTeX JavaScript; scheduling (ts-fsrs) and storage
 * (localStorage, `ka-amc-formulas`) run in the browser.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC formula flashcards (beta)';
const DESCRIPTION =
  'Spaced-repetition flashcards for the AMC 8, AMC 10 and AMC 12 formula sheet. Grade your own ' +
  'recall and each card comes back just before you would forget it. No account needed.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc/formulas/drill' },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: '/amc/formulas/drill',
      type: 'website',
    },
  };
}

export default function AmcFormulaDrillPage() {
  const areaName = new Map(getAmcTaxonomy().areas.map((area) => [area.id, area.name]));
  const cards: DrillCard[] = getAmcFormulas().map((formula) => ({
    id: formula.id,
    name: formula.name,
    areaName: areaName.get(formula.area) ?? formula.area,
    priority: formula.priority,
    contests: [...formula.contests],
    front: <MathText text={formula.whenToUse} />,
    back: (
      <>
        <div
          className="overflow-x-auto rounded-control bg-surface-2 px-3 py-3 text-lg text-ink"
          // Rendered by KaTeX from our own reviewed content files, never from user input.
          dangerouslySetInnerHTML={{ __html: renderMath(formula.formula, true) }}
        />
        <p className="m-0 mt-3 text-sm text-ink-2">
          <span className="ui font-semibold text-ink">Example. </span>
          <MathText text={formula.example} />
        </p>
      </>
    ),
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            AMC formula sheet <BetaBadge />
          </>
        }
        title="Formula flashcards"
        description="The front gives a formula's name and when to use it. Recall the formula, show the back, and grade yourself honestly: the schedule is only as good as the grades."
      />
      <FormulaDrill cards={cards} />
    </PageContainer>
  );
}
