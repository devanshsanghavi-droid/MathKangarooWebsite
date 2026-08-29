import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getSkill } from '@/lib/content';
import { parseWorksheetQuery, selectProblems, type RawSearchParams } from '@/lib/worksheet';
import { WorksheetControls } from '@/components/print/WorksheetControls';
import { FigureRenderer } from '@/components/FigureRenderer';
import { EmptyState } from '@/components/EmptyState';
import { printHref } from '@/lib/worksheet';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Worksheet generator',
  description:
    'Build a printable worksheet from the problem bank, with an answer key that gives the ' +
    'misconception behind every wrong choice.',
  alternates: { canonical: '/print' },
  robots: { index: false },
};

/**
 * `/print` — a worksheet and its answer key, on one page, both driven entirely by the URL.
 *
 * The answer key is the part that does not exist anywhere else: for every wrong choice it
 * gives the misconception that produces it, so a tutor marking a stack of sheets can see what
 * a student was thinking rather than only that they were wrong.
 */
export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseWorksheetQuery(await searchParams);
  const { selected, available } = selectProblems(getAllProblems(), query);
  const title = query.title || 'Math Kangaroo practice';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print">
        <h1 className="m-0 text-2xl">Worksheet generator</h1>
        <p className="prose-measure mt-3 mb-6 text-ink-2">
          Pick what you want, print the page. The answer key comes with it, on its own sheet, and it
          tells you the mistake behind every wrong choice — not just which letter is right.
        </p>
        <WorksheetControls query={query} available={available} selected={selected.length} />
      </div>

      {selected.length === 0 ? (
        <div className="no-print mt-6">
          <EmptyState action={<Link href={printHref({})}>Start over</Link>}>
            No problem matches these filters. There are {getAllProblems().length} problems in the
            bank altogether.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------ the sheet */}
          <section aria-labelledby="worksheet-heading" className="worksheet mt-10">
            <header className="border-b border-rule pb-3">
              <h2 id="worksheet-heading" className="m-0 text-lg">
                {title}
              </h2>
              <p className="mt-1 mb-0 flex flex-wrap gap-x-4 text-xs text-ink-3">
                <span>Name: ______________________</span>
                <span>Date: ____________</span>
                <span className="mono">
                  {selected.length} questions · {selected.reduce((n, p) => n + p.points, 0)} points
                </span>
              </p>
            </header>

            <ol className="m-0 grid list-none gap-8 p-0 pt-6">
              {selected.map((problem, index) => (
                <li key={problem.id} className="worksheet-item">
                  <p className="serif m-0 text-ink">
                    <span className="mono mr-2 font-semibold">{index + 1}.</span>
                    {problem.statement}
                    <span className="mono ml-2 text-2xs text-ink-3">[{problem.points}]</span>
                  </p>
                  {problem.figure ? (
                    <FigureRenderer figure={problem.figure} problemId={problem.id} />
                  ) : null}
                  <ul className="m-0 mt-3 grid list-none gap-1 p-0 pl-6 sm:grid-cols-2">
                    {problem.choices.map((choice) => (
                      <li key={choice.key} className="serif text-sm text-ink">
                        <span className="mono mr-2 text-ink-3">{choice.key}</span>
                        {choice.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            <p className="mono mt-8 border-t border-rule pt-3 text-2xs text-ink-3">
              {SITE.name} · {SITE.url} · seed {query.seed} · CC BY-NC-SA 4.0 · Independent project,
              not affiliated with Math Kangaroo in USA, NFP.
            </p>
          </section>

          {/* -------------------------------------------------- the answer key */}
          <section aria-labelledby="key-heading" className="answer-key mt-16">
            <header className="border-b border-rule pb-3">
              <h2 id="key-heading" className="m-0 text-lg">
                Answer key — {title}
              </h2>
              <p className="mt-1 mb-0 text-xs text-ink-3">
                Each wrong choice carries the thinking that produces it. When a student picks C,
                this is what they were doing.
              </p>
            </header>

            <ol className="m-0 grid list-none gap-6 p-0 pt-6">
              {selected.map((problem, index) => {
                const correct = problem.choices.find((choice) => choice.correct);
                const skill = getSkill(problem.skills.primary);
                return (
                  <li key={problem.id} className="worksheet-item">
                    <p className="m-0 flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="mono font-semibold text-ink">{index + 1}.</span>
                      <span className="font-semibold text-ink">
                        {correct?.key} — {correct?.text}
                      </span>
                      <span className="mono text-2xs text-ink-3">{problem.id}</span>
                      {skill ? <span className="text-xs text-ink-3">{skill.name}</span> : null}
                    </p>
                    <ul className="m-0 mt-2 grid list-none gap-1 p-0 pl-6">
                      {problem.choices
                        .filter((choice) => !choice.correct)
                        .map((choice) => (
                          <li key={choice.key} className="text-sm text-ink-2">
                            <span className="mono mr-2 text-ink-3">{choice.key}</span>
                            {choice.misconception}
                          </li>
                        ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
