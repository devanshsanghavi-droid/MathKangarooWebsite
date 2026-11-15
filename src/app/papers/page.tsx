import type { Metadata } from 'next';
import Link from '@/components/AppLink';
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
import {
  buttonClasses,
  Card,
  CardHeader,
  PageContainer,
  PageHeader,
  StatTile,
} from '@/components/ui';

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

  const indexedQuestions = papers.reduce((n, paper) => n + paper.questions.length, 0);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Past papers"
        title="Official paper index"
        description={
          <>
            Past papers tell you what you got wrong. They do not tell you <em>why</em>. This index
            is our answer to that: for each published paper, every question mapped to the skills it
            tests, so a score becomes a list of things to work on.
          </>
        }
        actions={
          <a
            href="https://mathkangaroo.org"
            rel="noreferrer"
            className={buttonClasses({ variant: 'secondary' })}
          >
            Official papers on mathkangaroo.org
          </a>
        }
      />

      <Card as="aside" aria-labelledby="index-note" padding="md" className="bg-surface-2">
        <h2 id="index-note" className="ui m-0 text-sm font-semibold text-ink">
          What this index is, and what it is not
        </h2>
        <p className="prose-measure mt-1 mb-0 text-sm text-ink-2">
          Every row here is <strong>our analysis</strong>: a question number, its point value, the
          skills we think it tests, and sometimes a short characterisation in our own words. The
          questions, the figures and the answers are Math Kangaroo&rsquo;s, they are not reproduced
          here, and they never will be. Where a paper is published free, we link to the official PDF
          on{' '}
          <a href="https://mathkangaroo.org" rel="noreferrer">
            mathkangaroo.org
          </a>{' '}
          and you read it there.
        </p>
      </Card>

      {papers.length === 0 ? (
        <div className="mt-6">
          <EmptyState action={<Link href="/atlas">Browse the Skill Atlas instead</Link>}>
            No paper has been indexed yet. Indexing one means sitting down with the official PDF and
            classifying all {expectedQuestionCount('5-6')} questions against the Atlas. It is
            reading work, not code, and it is the honest kind: an index someone guessed at would
            send a student to the wrong skill.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatTile label="Papers indexed" value={papers.length} detail="published papers" />
            <StatTile
              label="Questions classified"
              value={indexedQuestions}
              detail="each tagged with the skills it tests"
            />
            <StatTile
              label="Levels covered"
              value={grouped.size}
              detail={`of ${BANDS.length} levels`}
            />
          </div>

          <section aria-labelledby="papers-heading" className="mt-8">
            <h2 id="papers-heading" className="ui m-0 text-lg font-semibold">
              Indexed papers
            </h2>
            <ul className="m-0 mt-3 grid list-none gap-4 p-0 md:grid-cols-2">
              {BANDS.filter((band) => grouped.has(band)).map((band) => (
                <li key={band}>
                  <Card padding="md" className="h-full">
                    <h3 className="ui m-0 flex items-center gap-2 text-sm font-semibold text-ink">
                      <BandPill band={band} />
                      <span className="font-normal text-ink-2">
                        {grouped.get(band)?.length} indexed
                      </span>
                    </h3>
                    <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                      {grouped.get(band)?.map((paper) => (
                        <li key={paperSlug(paper)}>
                          <Link
                            href={`/papers/${paperSlug(paper)}`}
                            className="ui block rounded-control border border-rule px-3 py-2.5 no-underline transition-colors hover:border-rule-strong hover:bg-surface-2 motion-reduce:transition-none"
                          >
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="text-sm font-semibold text-ink">
                                {paperTitle(paper)}
                              </span>
                              <span className="mono text-2xs text-ink-2">
                                {paper.questions.length} of {expectedQuestionCount(paper.band)}{' '}
                                questions
                                {isComplete(paper) ? null : <>, partial index</>}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-track"
                            >
                              <span
                                className="block h-full rounded-pill bg-accent-600"
                                style={{
                                  width: `${Math.round(
                                    (paper.questions.length / expectedQuestionCount(paper.band)) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {BANDS.filter((band) => grouped.has(band)).map((band) => {
              const bandPapers = grouped.get(band) ?? [];
              const questionCount = bandPapers.reduce((n, paper) => n + paper.questions.length, 0);
              return (
                <Card as="section" key={band} aria-labelledby={`most-tested-${band}`} padding="lg">
                  <CardHeader
                    titleId={`most-tested-${band}`}
                    title={`Skills most tested at level ${band}`}
                    description={`Across ${bandPapers.length} indexed ${
                      bandPapers.length === 1 ? 'paper' : 'papers'
                    }, ${questionCount} questions.`}
                  />
                  <div className="mt-4">
                    <MostTestedSkills
                      frequencies={mostTestedSkills(bandPapers, 10)}
                      skillNames={skillNames}
                      questionCount={questionCount}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <section aria-labelledby="where-heading" className="mt-10 border-t border-rule pt-6">
        <h2 id="where-heading" className="ui m-0 text-lg font-semibold">
          Where to find the official papers
        </h2>
        <p className="prose-measure mt-2 mb-0 text-ink-2">
          Math Kangaroo publishes sample and past papers on its own site. Go there for the
          questions; come back here for what they test. We deliberately do not mirror them: a copy
          on our server would be both a copyright problem and one more thing to go stale.
        </p>
        <p className="mt-3 mb-0">
          <a href="https://mathkangaroo.org" rel="noreferrer">
            mathkangaroo.org
          </a>
        </p>
      </section>
    </PageContainer>
  );
}
