import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPapers, getAllSkills } from '@/lib/content';
import {
  expectedQuestionCount,
  isComplete,
  mostTestedSkills,
  papersByBand,
  paperSlug,
  paperTitle,
} from '@/lib/papers';
import { BANDS } from '@/lib/schemas';
import { MostTestedSkills } from '@/components/papers/MostTestedSkills';
import { BandPill } from '@/components/BandPill';
import { EmptyState } from '@/components/EmptyState';
import { Callout } from '@/components/Callout';

export const metadata: Metadata = {
  title: 'Official paper index',
  description:
    'Our skill analysis of published Math Kangaroo papers: question number, point value and ' +
    'the skills each question tests. The papers themselves stay on mathkangaroo.org.',
  alternates: { canonical: '/papers' },
};

/**
 * The bridge to official material, built the only way it can legally and honestly be built.
 *
 * We link to the official PDFs, which Math Kangaroo publishes free. We publish our own index of
 * them. The two things never mix: no official problem text, no official figure and no answer
 * appears anywhere in this repository, and a CI tripwire caps every file in `content/papers/`
 * at 2KB precisely so that nobody can quietly start pasting them in.
 */
export default function PapersPage() {
  const papers = getAllPapers();
  const grouped = papersByBand(papers);
  const skillNames = new Map(getAllSkills().map((skill) => [skill.id, skill.name]));

  return (
    <div className="content-column px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Official paper index</h1>
        <p className="mt-3 mb-0 text-ink-2">
          Past papers tell you what you got wrong. They do not tell you <em>why</em>. This index is
          our answer to that: for each published paper, every question mapped to the skills it
          tests, so a score becomes a list of things to work on.
        </p>
      </header>

      <div className="mt-6">
        <Callout title="What this index is, and what it is not">
          <p className="m-0">
            Every row here is <strong>our analysis</strong>: a question number, its point value, the
            skills we think it tests, and sometimes a short characterisation in our own words. The
            questions, the figures and the answers are Math Kangaroo&rsquo;s, they are not
            reproduced here, and they never will be. Where a paper is published free, we link to the
            official PDF on{' '}
            <a href="https://mathkangaroo.org" rel="noreferrer">
              mathkangaroo.org
            </a>{' '}
            and you read it there.
          </p>
        </Callout>
      </div>

      {papers.length === 0 ? (
        <div className="mt-8">
          <EmptyState action={<Link href="/atlas">Browse the Skill Atlas instead</Link>}>
            No paper has been indexed yet. Indexing one means sitting down with the official PDF and
            classifying all {expectedQuestionCount('5-6')} questions against the Atlas - it is
            reading work, not code, and it is the honest kind: an index someone guessed at would
            send a student to the wrong skill.
          </EmptyState>
        </div>
      ) : (
        <>
          <section aria-labelledby="papers-heading" className="mt-10">
            <h2 id="papers-heading" className="m-0 text-lg">
              Indexed papers
            </h2>
            <ul className="mt-3 grid list-none gap-6 p-0">
              {BANDS.filter((band) => grouped.has(band)).map((band) => (
                <li key={band}>
                  <h3 className="m-0 flex items-baseline gap-2 text-sm font-semibold text-ink">
                    <BandPill band={band} />
                    <span className="font-normal text-ink-3">
                      {grouped.get(band)?.length} indexed
                    </span>
                  </h3>
                  <ul className="mt-2 grid list-none gap-2 p-0">
                    {grouped.get(band)?.map((paper) => (
                      <li key={paperSlug(paper)}>
                        <Link
                          href={`/papers/${paperSlug(paper)}`}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-rule bg-surface px-3 py-2 no-underline hover:border-rule-strong"
                        >
                          <span className="text-sm text-ink">{paperTitle(paper)}</span>
                          <span className="mono text-2xs text-ink-3">
                            {paper.questions.length} of {expectedQuestionCount(paper.band)}{' '}
                            questions
                          </span>
                          {isComplete(paper) ? null : (
                            <span className="mono text-2xs text-ink-3">partial index</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {BANDS.filter((band) => grouped.has(band)).map((band) => {
            const bandPapers = grouped.get(band) ?? [];
            const questionCount = bandPapers.reduce((n, paper) => n + paper.questions.length, 0);
            return (
              <section key={band} aria-labelledby={`most-tested-${band}`} className="mt-10">
                <h2 id={`most-tested-${band}`} className="m-0 text-lg">
                  Skills most tested at level {band.replace('-', '–')}
                </h2>
                <p className="mt-1 mb-3 text-sm text-ink-3">
                  Across {bandPapers.length} indexed {bandPapers.length === 1 ? 'paper' : 'papers'},{' '}
                  {questionCount} questions.
                </p>
                <MostTestedSkills
                  frequencies={mostTestedSkills(bandPapers, 10)}
                  skillNames={skillNames}
                  questionCount={questionCount}
                />
              </section>
            );
          })}
        </>
      )}

      <section aria-labelledby="where-heading" className="mt-12 border-t border-rule pt-6">
        <h2 id="where-heading" className="m-0 text-lg">
          Where to find the official papers
        </h2>
        <p className="prose-measure mt-3 mb-0 text-ink-2">
          Math Kangaroo publishes sample and past papers on its own site. Go there for the
          questions; come back here for what they test. We deliberately do not mirror them - a copy
          on our server would be both a copyright problem and one more thing to go stale.
        </p>
        <p className="mt-3 mb-0">
          <a href="https://mathkangaroo.org" rel="noreferrer">
            mathkangaroo.org
          </a>
        </p>
      </section>
    </div>
  );
}
