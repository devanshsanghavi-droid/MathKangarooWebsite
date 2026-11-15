import type { Metadata } from 'next';
import { getAllAmcProblems, getAmcTaxonomy } from '@/lib/amc-content';
import { AmcTypeIndex, type AmcTypeSummary } from '@/components/amc/AmcTypeIndex';
import { BetaBadge, PageContainer, PageHeader } from '@/components/ui';

/**
 * `/amc/types` - every recurring competition pattern in the AMC beta (docs/06 §5), with how
 * to recognise it and how much of it the student has solved. Static; the area filter and the
 * progress bars run in the browser.
 */
export const dynamic = 'force-static';

const TITLE = 'AMC problem types (beta)';
const DESCRIPTION =
  'The recurring patterns behind AMC 10 and AMC 12 problems, from complementary counting and ' +
  "Vieta's formulas to power of a point, each with the cues that should make you reach for it.";

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/amc/types' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/amc/types', type: 'website' },
  };
}

export default function AmcTypesPage() {
  const taxonomy = getAmcTaxonomy();
  const problems = getAllAmcProblems();
  const areaName = new Map(taxonomy.areas.map((area) => [area.id, area.name]));
  const types: AmcTypeSummary[] = [...taxonomy.types]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((type) => ({
      id: type.id,
      name: type.name,
      description: type.description,
      cue: type.recognizeWhen[0] ?? '',
      areas: type.areas.map((id) => ({ id, name: areaName.get(id) ?? id })),
      problems: problems
        .filter((problem) => problem.types.includes(type.id))
        .map((problem) => ({ id: problem.id, slot: problem.slot })),
    }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            AMC 10 and AMC 12 <BetaBadge />
          </>
        }
        title="Problem types"
        description="Most AMC problems are one of a few dozen recurring patterns in disguise. Learn to spot the pattern and the first step usually follows. Each type lists the cues to look for, the formulas it leans on and its problems."
      />
      <AmcTypeIndex
        types={types}
        areas={taxonomy.areas.map((area) => ({ id: area.id, name: area.name }))}
      />
    </PageContainer>
  );
}
