import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/AppLink';
import { getAllAmcProblems, getAmcFormula, getAmcProblem, getAmcTaxonomy } from '@/lib/amc-content';
import { amcContestFolder, amcTierOf, type AmcProblem } from '@/lib/amc-schemas';
import { amcContestLabel, amcPracticeItem, amcTierLabel } from '@/lib/practice-item';
import { SITE } from '@/lib/site';
import { PracticeSession } from '@/components/practice-session';
import { MathProvider } from '@/components/math/MathProvider';
import { FormulaCard } from '@/components/amc/FormulaCard';
import { Badge, BetaBadge, PageContainer } from '@/components/ui';
import type { Formula } from '@/lib/amc-schemas';

interface Params {
  params: Promise<{ id: string }>;
}

/** Every AMC problem is a static page; an unknown id is a real 404, not a 200 not-found. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAllAmcProblems().map((problem) => ({ id: problem.id }));
}

function topicOf(problem: AmcProblem) {
  return getAmcTaxonomy().topics.find((topic) => topic.id === problem.topic);
}

/** Plain-words summary for search snippets: never the statement's math, never the answer. */
function describe(problem: AmcProblem, topicName: string): string {
  return (
    `An original ${amcContestLabel(problem.contest)} style problem on ${topicName.toLowerCase()}, ` +
    `${amcTierLabel(problem.slot).toLowerCase()}. Every wrong answer explains the mistake behind it.`
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const problem = getAmcProblem(id);
  if (!problem) return { title: 'Problem not found', robots: { index: false } };
  const topicName = topicOf(problem)?.name ?? problem.topic;
  const title = `${problem.id} - ${topicName} (AMC beta)`;
  const description = describe(problem, topicName);
  return {
    title,
    description,
    alternates: { canonical: `/amc/problem/${problem.id}` },
    openGraph: { title, description, type: 'article', url: `/amc/problem/${problem.id}` },
  };
}

/** A prefilled GitHub issue, like the Kangaroo report link: public, auditable, no backend. */
function reportAmcProblemUrl(problem: AmcProblem): string {
  const body = [
    `**Problem:** ${problem.id} (${amcContestLabel(problem.contest)}, slot ${problem.slot})`,
    `**File:** \`content/amc/problems/${amcContestFolder(problem.contest)}/${problem.id}.json\``,
    `**Page:** ${SITE.url}/amc/problem/${problem.id}`,
    '',
    '**What is wrong?**',
    '',
  ].join('\n');
  const query = new URLSearchParams({
    title: `AMC problem ${problem.id}: `,
    body,
    labels: 'problem-error',
  });
  return `${SITE.repo}/issues/new?${query.toString()}`;
}

/** LearningResource JSON-LD. The answer is left out, so it never reaches a search snippet. */
function StructuredData({ problem, topicName }: { problem: AmcProblem; topicName: string }) {
  const url = `${SITE.url}/amc/problem/${problem.id}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': url,
    url,
    name: `${problem.id} - ${topicName}`,
    description: describe(problem, topicName),
    learningResourceType: 'Practice problem',
    educationalLevel: amcContestLabel(problem.contest),
    teaches: topicName,
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    author: { '@type': 'Person', name: problem.author },
    isPartOf: { '@id': `${SITE.url}/#website` },
  };
  return (
    <script
      type="application/ld+json"
      // Built from our own reviewed content files. `<` is escaped so nothing closes the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

const TIER_MEANING = {
  Early:
    'Early problems (slots 1-10) reward clean setup and care. Most of the paper score is here.',
  Middle: 'Middle problems (slots 11-20) usually need one real idea on top of the routine work.',
  Late: 'Late problems (slots 21-25) need an idea you have to find. Skipping is often the right call on the day.',
} as const;

/** The AMC 8 has no penalty for a wrong answer (docs/07 section 2), so never advise a skip. */
const AMC8_LATE =
  'Late problems (slots 21-25) need an idea you have to find. A wrong answer costs nothing on the AMC 8, so always put down your best guess.';

/**
 * `/amc/problem/[id]` - one AMC beta problem as a practice session of one (docs/06 §5).
 *
 * The statement, choices and math are server-rendered inside <MathProvider>, so the
 * prerendered HTML carries the whole problem, typeset, for a crawler or a reader without
 * JavaScript. The attempt is recorded under the AM id (saveAmcAttempt).
 */
export default async function AmcProblemPage({ params }: Params) {
  const { id } = await params;
  const problem = getAmcProblem(id);
  if (!problem) notFound();

  const taxonomy = getAmcTaxonomy();
  const topic = topicOf(problem);
  const topicName = topic?.name ?? problem.topic;
  const area = taxonomy.areas.find((entry) => entry.id === problem.area);
  const types = problem.types
    .map((typeId) => taxonomy.types.find((type) => type.id === typeId))
    .filter((type) => type !== undefined);
  const formulas = problem.formulas
    .map((formulaId) => getAmcFormula(formulaId))
    .filter((formula): formula is Formula => formula !== undefined);
  const item = amcPracticeItem(
    problem,
    (topicId) => taxonomy.topics.find((entry) => entry.id === topicId)?.name,
  );

  // Previous / next in the same topic, in paper order.
  const inTopic = getAllAmcProblems()
    .filter((entry) => entry.topic === problem.topic)
    .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
  const position = inTopic.findIndex((entry) => entry.id === problem.id);
  const previous = position > 0 ? inTopic[position - 1] : undefined;
  const next = position >= 0 ? inTopic[position + 1] : undefined;
  const tier = amcTierOf(problem.slot);

  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <StructuredData problem={problem} topicName={topicName} />
        <nav aria-label="Breadcrumb" className="ui mb-4 text-xs text-ink-3">
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            <li>
              <Link href="/amc" className="no-underline hover:underline">
                AMC beta
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/amc/problems" className="no-underline hover:underline">
                Problems
              </Link>
            </li>
            {area ? (
              <>
                <li aria-hidden="true">/</li>
                <li>{area.name}</li>
              </>
            ) : null}
            <li aria-hidden="true">/</li>
            <li className="mono text-ink-2">{problem.id}</li>
          </ol>
        </nav>

        <MathProvider>
          <PracticeSession
            items={[item]}
            title={problem.id}
            mode="single"
            headingLevel={1}
            headingSuffix={topicName}
            exitHref="/amc/problems"
          />
        </MathProvider>

        <div className="mt-6 grid gap-4">
          <p className="ui m-0 flex flex-wrap items-baseline gap-2 text-sm text-ink-2">
            <BetaBadge />
            <span className="font-medium text-ink">{item.tierLabel}</span>
            <span>
              {problem.contest === 'AMC8' && tier === 'Late' ? AMC8_LATE : TIER_MEANING[tier]}
            </span>
            <span className="text-ink-3">{amcContestLabel(problem.contest)}.</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-2xs text-ink-3">Topic</span>
            <Badge>{topicName}</Badge>
            <span className="mono ml-2 text-2xs text-ink-3">Problem types</span>
            {types.map((type) => (
              <Link
                key={type.id}
                href={`/amc/type/${type.id}`}
                className="ui inline-flex min-h-9 items-center rounded-pill border border-rule-strong bg-surface px-3 text-xs font-medium text-ink no-underline hover:bg-surface-2"
              >
                {type.name}
              </Link>
            ))}
          </div>

          {formulas.length > 0 ? (
            <details className="rounded-card border border-rule bg-surface p-4">
              <summary className="ui cursor-pointer text-sm font-semibold text-ink">
                Formulas this problem uses ({formulas.length})
              </summary>
              <p className="ui m-0 mt-2 text-xs text-ink-3">
                Folded away so it does not give the game away. Open it after you have tried.
              </p>
              <ul className="m-0 mt-3 grid list-none gap-3 p-0">
                {formulas.map((formula) => (
                  <li key={formula.id}>
                    <FormulaCard formula={formula} compact headingLevel={2} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <nav
          aria-label="More problems in this topic"
          className="mt-8 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/amc/problem/${previous.id}`}
              rel="prev"
              className="rounded-card border border-rule bg-surface p-3 no-underline hover:border-rule-strong"
            >
              <span className="block text-2xs text-ink-3">Previous in this topic</span>
              <span className="mono mt-1 block text-sm text-accent-700">{previous.id}</span>
              <span className="mt-1 block text-xs text-ink-2">{amcTierLabel(previous.slot)}</span>
            </Link>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-rule p-3 text-xs text-ink-3">
              This is the first problem in {topicName}.
            </p>
          )}
          {next ? (
            <Link
              href={`/amc/problem/${next.id}`}
              rel="next"
              className="rounded-card border border-rule bg-surface p-3 text-right no-underline hover:border-rule-strong"
            >
              <span className="block text-2xs text-ink-3">Next in this topic</span>
              <span className="mono mt-1 block text-sm text-accent-700">{next.id}</span>
              <span className="mt-1 block text-xs text-ink-2">{amcTierLabel(next.slot)}</span>
            </Link>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-rule p-3 text-right text-xs text-ink-3">
              This is the last problem in {topicName}.
            </p>
          )}
        </nav>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
          <p className="m-0">
            {position >= 0 ? `Problem ${position + 1} of ${inTopic.length} in this topic.` : null}
          </p>
          <a
            href={reportAmcProblemUrl(problem)}
            className="no-underline hover:underline"
            rel="noreferrer"
          >
            Report an error in this problem
          </a>
        </div>
      </div>
    </PageContainer>
  );
}
