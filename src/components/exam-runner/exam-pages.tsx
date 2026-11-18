import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { MathProvider } from '@/components/math/MathProvider';
import { PageContainer, PageHeader } from '@/components/ui';
import { TEST_LABEL, TEST_SLUG, type StdTest } from '@/lib/test-meta';
import { EXAM_SPECS, SECTION_TEST_SIZE, mockMinutes, mockQuestionCount } from '@/lib/exam-engine';
import { TestMockApp, TestSectionApp } from './TestExams';

/**
 * Server shells for the mock and section-test routes (docs/07 section 4). Each page is static:
 * the header and the format facts are prerendered, and the start screen, the sitting and the
 * report run in the browser over public/data.
 */

export function examMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website' },
  };
}

/** The format facts, prerendered so the page says what it is before any script runs. */
export function FormatFacts({ facts }: { facts: ReadonlyArray<[string, string]> }) {
  return (
    <dl className="ui m-0 mb-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      {facts.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="font-semibold text-ink">{term}</dt>
          <dd className="m-0 text-ink-2">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExamPageShell({
  eyebrow,
  title,
  description,
  facts,
  math,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  description: ReactNode;
  facts: ReadonlyArray<[string, string]>;
  math: boolean;
  children: ReactNode;
}) {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[56rem]">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        <FormatFacts facts={facts} />
        {math ? <MathProvider>{children}</MathProvider> : children}
      </div>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* SAT and ACT                                                                 */
/* -------------------------------------------------------------------------- */

function testMockCopy(test: StdTest) {
  const label = TEST_LABEL[test];
  const spec = EXAM_SPECS[test];
  const modules = spec.mock ?? [];
  const format =
    modules.length > 1
      ? `${mockQuestionCount(spec)} questions in ${modules.length} modules of ${modules[0]?.count ?? 0}, ${modules[0]?.minutes ?? 0} minutes each`
      : `${mockQuestionCount(spec)} questions in ${mockMinutes(spec)} minutes`;
  return {
    label,
    format,
    title: `${label} mock test`,
    description:
      `A free timed ${label} practice test in the real format (${format}) from original ` +
      'questions. Raw score, an approximate scaled score, and every mistake explained. No account.',
  };
}

export function testMockMetadata(test: StdTest): Metadata {
  const copy = testMockCopy(test);
  return examMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${TEST_SLUG[test]}/mock`,
  });
}

export function TestMockPage({ test }: { test: StdTest }) {
  const copy = testMockCopy(test);
  return (
    <ExamPageShell
      eyebrow={copy.label}
      title={copy.title}
      description="A full practice test from our own original questions, timed, with a report that shows where the points went and what to work on next."
      facts={[
        ['Format', `${copy.format}, not adaptive`],
        ['Scoring', '1 point per right answer, nothing off for a wrong one'],
        ['Calculator', 'Allowed throughout, as on the real test'],
        ['Report', 'Raw score, an approximate scaled score (an estimate), accuracy by section'],
      ]}
      math
    >
      <TestMockApp test={test} />
    </ExamPageShell>
  );
}

function testSectionCopy(test: StdTest) {
  const label = TEST_LABEL[test];
  const noun = EXAM_SPECS[test].sectionNoun;
  return {
    label,
    noun,
    title: `${label} section test`,
    description:
      `${SECTION_TEST_SIZE} timed ${label} questions from one ${noun}, easy to hard, then a ` +
      'report with every mistake explained. Original questions, free, no account.',
  };
}

export function testSectionMetadata(test: StdTest): Metadata {
  const copy = testSectionCopy(test);
  return examMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${TEST_SLUG[test]}/section`,
  });
}

export function TestSectionPage({ test }: { test: StdTest }) {
  const copy = testSectionCopy(test);
  return (
    <ExamPageShell
      eyebrow={copy.label}
      title={copy.title}
      description={`Check one ${copy.noun} at a time: ${SECTION_TEST_SIZE} questions, timed, with the same report as the full mock.`}
      facts={[
        ['Questions', `${SECTION_TEST_SIZE} from the ${copy.noun} you choose, easy to hard`],
        ['Time', 'The sum of each question’s usual time, rounded up to the minute'],
        ['Scoring', '1 point per right answer'],
      ]}
      math
    >
      <TestSectionApp test={test} />
    </ExamPageShell>
  );
}
