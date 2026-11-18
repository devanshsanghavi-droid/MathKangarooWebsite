import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/AppLink';
import {
  getAllTestProblems,
  getTestCounts,
  getTestProblem,
  getTestSkill,
  getTestTaxonomy,
} from '@/lib/test-content';
import {
  TEST_DIFFICULTIES,
  TEST_DIFFICULTY_LABEL,
  TEST_SLUG,
  type StdTest,
  type TestProblem,
} from '@/lib/test-schemas';
import { buildTestIndexFile, testSkillNames } from '@/lib/bank-data';
import { BANK_PAGE_SIZE, testBankRows, testBankTaxonomy } from '@/lib/bank-filter';
import { testPracticeItem } from '@/lib/practice-item';
import { SITE } from '@/lib/site';
import { AreaSubnav } from '@/components/AreaSubnav';
import { TrademarkNotice } from '@/components/TrademarkNotice';
import { QuestionBank } from '@/components/problems/QuestionBank';
import { PracticeSession, PracticeSetLoader } from '@/components/practice-session';
import { MathProvider } from '@/components/math/MathProvider';
import { Badge, PageContainer, PageHeader } from '@/components/ui';
import { TEST_AREAS, testAreaSections } from './test-area';
import { TestHome } from './TestHome';

/**
 * The SAT and ACT areas (docs/07 section 4) as shared server components: src/app/sat/* and
 * src/app/act/* are thin files that pass their test. Every page is static. The content is read
 * at build time through test-content.ts, never at request time.
 *
 *   TestAreaLayout   subnav + the area's trademark notice, around every page
 *   TestHomePage     /sat, /act
 *   TestBankPage     /sat/problems, /act/problems (the shared <QuestionBank>)
 *   TestProblemPage  /sat/problem/[id], /act/problem/[id] (a <PracticeSession> of one)
 *   TestPracticePage /sat/practice, /act/practice (the shared <PracticeSetLoader>)
 */

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function TestAreaLayout({ test, children }: { test: StdTest; children: ReactNode }) {
  const area = TEST_AREAS[test];
  return (
    <>
      <AreaSubnav label={`${area.short} sections`} sections={testAreaSections(test)} />
      {children}
      <TrademarkNotice text={area.disclaimer} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Home                                                                        */
/* -------------------------------------------------------------------------- */

function homeCopy(test: StdTest) {
  const area = TEST_AREAS[test];
  return {
    title: `${area.name} practice`,
    description:
      `Free ${area.name} preparation: original questions by ${area.sectionNoun} and skill, ` +
      'timed mock and section tests, and an explanation for every wrong answer. No account.',
  };
}

export function testHomeMetadata(test: StdTest): Metadata {
  const { title, description } = homeCopy(test);
  const path = `/${TEST_SLUG[test]}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website' },
  };
}

export function TestHomePage({ test }: { test: StdTest }) {
  const area = TEST_AREAS[test];
  const taxonomy = getTestTaxonomy(test);
  const problems = getAllTestProblems(test).map((problem) => ({
    id: problem.id,
    domain: problem.domain,
    skill: problem.skill,
    difficulty: problem.difficulty,
  }));
  return (
    <PageContainer>
      <PageHeader eyebrow={area.name} title={homeCopy(test).title} description={area.intro} />
      <TestHome
        test={test}
        problems={problems}
        domains={taxonomy.domains.map((domain) => ({
          id: domain.id,
          name: domain.name,
          description: domain.description,
          skills: domain.skills.map((skill) => ({ id: skill.id, name: skill.name })),
        }))}
      />
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Bank                                                                        */
/* -------------------------------------------------------------------------- */

export function testBankMetadata(test: StdTest): Metadata {
  const area = TEST_AREAS[test];
  const title = `${area.name} question bank`;
  const description =
    `Original ${area.name} style questions, filterable by ${area.sectionNoun}, skill, ` +
    'difficulty and what you have solved. Every wrong answer explains the mistake behind it.';
  const path = `/${TEST_SLUG[test]}/problems`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website' },
  };
}

/**
 * The same <QuestionBank> as /problems and /amc/problems, given the test's taxonomy: domain
 * and skill checkboxes with solved / total, Easy / Medium / Hard, status. The first page is
 * baked in at build time; filtering runs in the browser over /data/<sat|act>-index.json.
 */
export function TestBankPage({ test }: { test: StdTest }) {
  const area = TEST_AREAS[test];
  const slug = TEST_SLUG[test];
  const problems = getAllTestProblems(test);
  const file = buildTestIndexFile(getTestTaxonomy(test), problems);
  const taxonomy = testBankTaxonomy(file);
  const initialRows = testBankRows(file, testSkillNames(file)).slice(0, BANK_PAGE_SIZE);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={area.name}
        title={`${area.short} question bank`}
        description={`${problems.length} ${problems.length === 1 ? 'question' : 'questions'} written from scratch in the style of the ${area.name} test. Pick a few skills or a difficulty, then start a set.`}
      />
      <MathProvider>
        <QuestionBank
          taxonomy={taxonomy}
          initialRows={initialRows}
          total={problems.length}
          listHeading={`${slug}-bank-list-heading`}
        />
      </MathProvider>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* One problem                                                                 */
/* -------------------------------------------------------------------------- */

export function testProblemParams(test: StdTest): Array<{ id: string }> {
  return getAllTestProblems(test).map((problem) => ({ id: problem.id }));
}

/** The problem, only if it belongs to this test (an AC id under /sat is a 404). */
function problemOf(test: StdTest, id: string): TestProblem | undefined {
  const problem = getTestProblem(id);
  return problem?.test === test ? problem : undefined;
}

function skillNameOf(problem: TestProblem): string {
  return getTestSkill(problem.test, problem.skill)?.skill.name ?? problem.skill;
}

/** Plain-words summary for search snippets: never the statement's math, never the answer. */
function describe(problem: TestProblem, skillName: string): string {
  return (
    `An original ${TEST_AREAS[problem.test].name} style question on ${skillName.toLowerCase()}, ` +
    `${TEST_DIFFICULTY_LABEL[problem.difficulty].toLowerCase()}. Every wrong answer explains ` +
    'the mistake behind it.'
  );
}

export function testProblemMetadata(test: StdTest, id: string): Metadata {
  const problem = problemOf(test, id);
  if (!problem) return { title: 'Problem not found', robots: { index: false } };
  const skillName = skillNameOf(problem);
  const title = `${problem.id} - ${skillName} (${TEST_AREAS[test].name})`;
  const description = describe(problem, skillName);
  const path = `/${TEST_SLUG[test]}/problem/${problem.id}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: 'article', url: path },
  };
}

/** A prefilled GitHub issue, like the Kangaroo and AMC report links: public, no backend. */
function reportUrl(problem: TestProblem): string {
  const slug = TEST_SLUG[problem.test];
  const body = [
    `**Problem:** ${problem.id} (${TEST_AREAS[problem.test].name}, ${problem.skill})`,
    `**File:** \`content/tests/${slug}/problems/${problem.id}.json\``,
    `**Page:** ${SITE.url}/${slug}/problem/${problem.id}`,
    '',
    '**What is wrong?**',
    '',
  ].join('\n');
  const query = new URLSearchParams({
    title: `${TEST_AREAS[problem.test].short} problem ${problem.id}: `,
    body,
    labels: 'problem-error',
  });
  return `${SITE.repo}/issues/new?${query.toString()}`;
}

/** LearningResource JSON-LD. The answer is left out, so it never reaches a search snippet. */
function ProblemStructuredData({
  problem,
  skillName,
}: {
  problem: TestProblem;
  skillName: string;
}) {
  const url = `${SITE.url}/${TEST_SLUG[problem.test]}/problem/${problem.id}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': url,
    url,
    name: `${problem.id} - ${skillName}`,
    description: describe(problem, skillName),
    learningResourceType: 'Practice problem',
    educationalLevel: TEST_AREAS[problem.test].name,
    teaches: skillName,
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

const DIFFICULTY_RANK = new Map(TEST_DIFFICULTIES.map((difficulty, index) => [difficulty, index]));

/**
 * One SAT or ACT question as a practice session of one. The statement, choices and math are
 * server-rendered inside <MathProvider>, so the prerendered HTML carries the whole problem,
 * typeset, for a crawler or a reader without JavaScript. The attempt is recorded under
 * `sat:<ID>` / `act:<ID>` (saveTestAttempt, via recordPracticeAttempt).
 */
export function TestProblemPage({ test, id }: { test: StdTest; id: string }) {
  const problem = problemOf(test, id);
  if (!problem) notFound();

  const area = TEST_AREAS[test];
  const slug = TEST_SLUG[test];
  const taxonomy = getTestTaxonomy(test);
  const domain = taxonomy.domains.find((entry) => entry.id === problem.domain);
  const skillName = skillNameOf(problem);
  const item = testPracticeItem(problem, (skillId) => getTestSkill(test, skillId)?.skill.name);

  // Previous / next in the same skill, easiest first.
  const inSkill = getAllTestProblems(test)
    .filter((entry) => entry.skill === problem.skill)
    .sort(
      (a, b) =>
        (DIFFICULTY_RANK.get(a.difficulty) ?? 0) - (DIFFICULTY_RANK.get(b.difficulty) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const position = inSkill.findIndex((entry) => entry.id === problem.id);
  const previous = position > 0 ? inSkill[position - 1] : undefined;
  const next = position >= 0 ? inSkill[position + 1] : undefined;

  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <ProblemStructuredData problem={problem} skillName={skillName} />
        <nav aria-label="Breadcrumb" className="ui mb-4 text-xs text-ink-3">
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            <li>
              <Link href={`/${slug}`} className="no-underline hover:underline">
                {area.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/${slug}/problems`} className="no-underline hover:underline">
                Problems
              </Link>
            </li>
            {domain ? (
              <>
                <li aria-hidden="true">/</li>
                <li>{domain.name}</li>
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
            headingSuffix={skillName}
            exitHref={`/${slug}/problems`}
          />
        </MathProvider>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mono text-2xs text-ink-3">{capitalise(area.sectionNoun)}</span>
          <Badge>{domain?.name ?? problem.domain}</Badge>
          <span className="mono ml-2 text-2xs text-ink-3">Skill</span>
          <Badge>{skillName}</Badge>
          <span className="ui ml-2 text-xs text-ink-3">Calculator allowed.</span>
        </div>

        <nav
          aria-label="More questions in this skill"
          className="mt-8 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/${slug}/problem/${previous.id}`}
              rel="prev"
              className="rounded-card border border-rule bg-surface p-3 no-underline hover:border-rule-strong"
            >
              <span className="block text-2xs text-ink-3">Previous in this skill</span>
              <span className="mono mt-1 block text-sm text-accent-700">{previous.id}</span>
              <span className="mt-1 block text-xs text-ink-2">
                {TEST_DIFFICULTY_LABEL[previous.difficulty]}
              </span>
            </Link>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-rule p-3 text-xs text-ink-3">
              This is the first question in {skillName}.
            </p>
          )}
          {next ? (
            <Link
              href={`/${slug}/problem/${next.id}`}
              rel="next"
              className="rounded-card border border-rule bg-surface p-3 text-right no-underline hover:border-rule-strong"
            >
              <span className="block text-2xs text-ink-3">Next in this skill</span>
              <span className="mono mt-1 block text-sm text-accent-700">{next.id}</span>
              <span className="mt-1 block text-xs text-ink-2">
                {TEST_DIFFICULTY_LABEL[next.difficulty]}
              </span>
            </Link>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-rule p-3 text-right text-xs text-ink-3">
              This is the last question in {skillName}.
            </p>
          )}
        </nav>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
          <p className="m-0">
            {position >= 0 ? `Question ${position + 1} of ${inSkill.length} in this skill.` : null}
          </p>
          <a href={reportUrl(problem)} className="no-underline hover:underline" rel="noreferrer">
            Report an error in this question
          </a>
        </div>
      </div>
    </PageContainer>
  );
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Practice set                                                                */
/* -------------------------------------------------------------------------- */

export function testPracticeMetadata(test: StdTest): Metadata {
  const area = TEST_AREAS[test];
  const title = `${area.name} practice set`;
  const description =
    `An ${area.name} practice set from the question bank: check each answer, read the ` +
    'mistake behind a wrong one, and see how the set went by skill at the end.';
  const path = `/${TEST_SLUG[test]}/practice`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: true },
    openGraph: { title, description, url: path, type: 'website' },
  };
}

/**
 * `/sat/practice?bank=sat&ids=SA-0001,...` - the same static page and loader as /practice/set
 * and /amc/practice (docs/06 §3), inside the area's layout so the set carries its notice.
 * Every set is a different URL over the same thin page, so none is indexed.
 */
export function TestPracticePage({ test }: { test: StdTest }) {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <h1 className="visually-hidden">{TEST_AREAS[test].short} practice set</h1>
        <PracticeSetLoader />
      </div>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Counts, for the share cards and the exams hub                               */
/* -------------------------------------------------------------------------- */

export function testProblemCount(test: StdTest): number {
  return getTestCounts(test).total;
}
