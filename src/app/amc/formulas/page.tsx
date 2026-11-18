import type { Metadata } from 'next';
import { getAmcFormulas, getAmcTaxonomy } from '@/lib/amc-content';
import { FormulaCard } from '@/components/amc/FormulaCard';
import { FormulaSheet, type FormulaSheetItem } from '@/components/amc/FormulaSheet';
import { BetaBadge, ButtonLink, PageContainer, PageHeader } from '@/components/ui';

/**
 * `/amc/formulas` - the AMC formula sheet (docs/06 §5): by area, must-know first, with a
 * contest filter, printable. Static. Every card is typeset on the server; the filter only
 * chooses which pre-rendered cards to show, so the page ships no KaTeX JavaScript.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC formula sheet (beta)';
const DESCRIPTION =
  'The formulas worth knowing cold for the AMC 8, AMC 10 and AMC 12, by area and must-know first, ' +
  'each with when to use it, a worked example and the usual pitfall. Printable.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc/formulas' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/amc/formulas', type: 'website' },
  };
}

export default function AmcFormulasPage() {
  const formulas = getAmcFormulas();
  const taxonomy = getAmcTaxonomy();
  const mustKnow = formulas.filter((formula) => formula.priority === 'must-know').length;
  const items: FormulaSheetItem[] = formulas.map((formula) => ({
    id: formula.id,
    area: formula.area,
    priority: formula.priority,
    contests: [...formula.contests],
    card: <FormulaCard formula={formula} headingLevel={4} anchor />,
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            AMC 8, AMC 10 and AMC 12 <BetaBadge />
          </>
        }
        title="Formula sheet"
        description={`${formulas.length} formulas, ${mustKnow} of them must-know. Each one says when to reach for it and the mistake people usually make with it. Nothing here replaces knowing why a formula is true; open "Why it is true" on any card.`}
        actions={
          <ButtonLink href="/amc/formulas/drill" variant="primary" className="no-print">
            Drill with flashcards
          </ButtonLink>
        }
      />
      <FormulaSheet
        items={items}
        areas={taxonomy.areas.map((area) => ({ id: area.id, name: area.name }))}
      />
    </PageContainer>
  );
}
