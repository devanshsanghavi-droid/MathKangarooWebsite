import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/AppLink';
import { getAmcFormulasForType, getAmcProblemsOfType, getAmcTaxonomy } from '@/lib/amc-content';
import { buildAmcIndex, buildAmcLookups } from '@/lib/bank-data';
import { amcBankRows, amcBankTaxonomy, taxonomyGroupNames } from '@/lib/bank-filter';
import { AmcProblemList } from '@/components/amc/AmcProblemList';
import { FormulaCard } from '@/components/amc/FormulaCard';
import { MathProvider } from '@/components/math/MathProvider';
import { Badge, BetaBadge, Card, PageContainer, PageHeader } from '@/components/ui';

interface Params {
  params: Promise<{ id: string }>;
}

/** Every type in the taxonomy is a static page; anything else is a real 404. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAmcTaxonomy().types.map((type) => ({ id: type.id }));
}

function findType(id: string) {
  return getAmcTaxonomy().types.find((type) => type.id === id);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const type = findType(id);
  if (!type) return { title: 'Problem type not found', robots: { index: false } };
  const title = `${type.name} - AMC problem type (beta)`;
  return {
    title,
    description: type.description,
    alternates: { canonical: `/amc/type/${type.id}` },
    openGraph: {
      title,
      description: type.description,
      url: `/amc/type/${type.id}`,
      type: 'article',
    },
  };
}

/**
 * `/amc/type/[id]` - one recurring competition pattern (docs/06 §5): what it is, the cues
 * that should make a student reach for it, the formulas it leans on, and every problem of the
 * type with the student's progress on them.
 */
export default async function AmcTypePage({ params }: Params) {
  const { id } = await params;
  const type = findType(id);
  if (!type) notFound();

  const taxonomy = getAmcTaxonomy();
  const problems = [...getAmcProblemsOfType(type.id)].sort(
    (a, b) => a.slot - b.slot || a.id.localeCompare(b.id),
  );
  const formulas = getAmcFormulasForType(type.id);
  const bank = amcBankTaxonomy(buildAmcLookups(taxonomy, problems));
  const rows = amcBankRows(buildAmcIndex(problems), taxonomyGroupNames(bank));
  // buildAmcIndex sorts by id; show the type in paper order, easiest first.
  const order = new Map(problems.map((problem, index) => [problem.id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const areaName = new Map(taxonomy.areas.map((area) => [area.id, area.name]));

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="ui mb-4 text-xs text-ink-3">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href="/amc" className="no-underline hover:underline">
              AMC beta
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/amc/types" className="no-underline hover:underline">
              Problem types
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink-2">{type.name}</li>
        </ol>
      </nav>

      <PageHeader
        eyebrow={
          <>
            Problem type <BetaBadge />
          </>
        }
        title={type.name}
        description={type.description}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-6">
          <Card as="section" aria-labelledby="type-cues" padding="lg">
            <h2 id="type-cues" className="ui m-0 text-base font-semibold text-ink">
              Reach for it when
            </h2>
            <ul className="m-0 mt-3 grid gap-2 pl-5 text-base text-ink">
              {type.recognizeWhen.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="ui text-2xs text-ink-3">Appears in</span>
              {type.areas.map((area) => (
                <Badge key={area}>{areaName.get(area) ?? area}</Badge>
              ))}
            </div>
          </Card>

          <MathProvider>
            <AmcProblemList
              rows={rows}
              heading={`Problems of this type (${rows.length})`}
              headingId="type-problems"
              setName={type.name}
              progressLabel={`${type.name}: solved`}
            />
          </MathProvider>
        </div>

        <section aria-labelledby="type-formulas" className="grid min-w-0 grid-cols-1 gap-3">
          <h2 id="type-formulas" className="ui m-0 text-base font-semibold text-ink">
            Formulas it leans on
          </h2>
          {formulas.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0">
              {formulas.map((formula) => (
                <li key={formula.id}>
                  <FormulaCard formula={formula} compact headingLevel={3} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui m-0 text-sm text-ink-2">
              This type is about an idea rather than a formula. Its problems are the practice.
            </p>
          )}
          <p className="ui m-0 text-xs">
            <Link href="/amc/formulas">The whole formula sheet</Link>
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
