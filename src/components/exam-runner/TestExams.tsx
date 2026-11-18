'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { fetchStaticJson } from '@/lib/bank-client';
import { dataPaths, type TestIndexFile } from '@/lib/bank-data';
import { TEST_LABEL, TEST_SLUG, type StdTest } from '@/lib/test-meta';
import {
  EXAM_SPECS,
  mockMinutes,
  mockQuestionCount,
  SECTION_TEST_MIN,
  SECTION_TEST_SIZE,
  sectionTestHref,
  type ExamState,
  type GroupResult,
} from '@/lib/exam-engine';
import {
  buildActMockPaper,
  buildSatMockPaper,
  buildSectionPaper,
  newSeed,
  testSectionRows,
} from '@/lib/exam-papers';
import { ExamSession, type StartScreenApi } from './ExamSession';
import {
  PaperChooser,
  SectionPicker,
  StartStatus,
  useQueryParams,
  useStaticData,
} from './start-ui';

function domainLabels(file: TestIndexFile): Record<string, string> {
  return Object.fromEntries(file.domains.map((domain) => [domain.id, domain.name]));
}

const loaders: Record<StdTest, () => Promise<TestIndexFile>> = {
  SAT: () => fetchStaticJson<TestIndexFile>(dataPaths.testIndex('SAT')),
  ACT: () => fetchStaticJson<TestIndexFile>(dataPaths.testIndex('ACT')),
};

/* -------------------------------------------------------------------------- */
/* /sat/mock and /act/mock                                                     */
/* -------------------------------------------------------------------------- */

function TestMockStart({ test, api }: { test: StdTest; api: StartScreenApi }) {
  const { data, failed } = useStaticData(loaders[test]);
  if (!data) return <StartStatus loading={!failed} failed={failed} />;
  const spec = EXAM_SPECS[test];
  const needed = mockQuestionCount(spec);
  const label = TEST_LABEL[test];
  const modules = spec.mock ?? [];
  const detail =
    modules.length > 1
      ? `${needed} questions in ${modules.length} modules of ${modules[0]?.count ?? 0}, ${modules[0]?.minutes ?? 0} minutes each`
      : `${needed} questions, ${mockMinutes(spec)} minutes`;

  return (
    <PaperChooser
      title={`${label} mock test`}
      intro={
        <p className="m-0">
          The real format, not adaptive: {detail}. One point for each right answer and nothing taken
          off for a wrong one, so never leave a question blank. A calculator is allowed throughout.
          {modules.length > 1
            ? ' Each module has its own clock, and a submitted module is closed, as on the real test.'
            : ''}{' '}
          The report gives your raw score and an approximate scaled score, clearly marked as an
          estimate.
        </p>
      }
      api={api}
      choices={[
        {
          id: test,
          title: `the ${label} mock`,
          detail: `${detail}, 1 point per right answer`,
          unavailable:
            data.rows.length >= needed
              ? null
              : `The bank holds ${data.rows.length} of the ${needed} questions a full ${label} mock needs, so it is not offered yet. Section tests and the question bank work now.`,
          onStart: () => {
            const seed = newSeed();
            const paper =
              test === 'SAT'
                ? buildSatMockPaper(data.rows, seed)
                : buildActMockPaper(data.rows, seed);
            if (paper.shortfall > 0) return;
            api.begin({
              kind: 'mock',
              exam: test,
              title: `${label} mock`,
              seed,
              problemIds: paper.problemIds,
              modules,
              labels: domainLabels(data),
            });
          },
        },
      ]}
    />
  );
}

function TestActions({
  test,
  state,
  again,
}: {
  test: StdTest;
  state: ExamState;
  again: () => void;
}) {
  const slug = TEST_SLUG[test];
  return (
    <>
      <Button variant="primary" onClick={again}>
        {state.kind === 'mock' ? 'Take another mock' : 'Take another section test'}
      </Button>
      <ButtonLink
        href={state.kind === 'mock' ? sectionTestHref(test) : `/${slug}/mock`}
        variant="secondary"
      >
        {state.kind === 'mock' ? 'Take a section test' : 'Take a full mock'}
      </ButtonLink>
      <ButtonLink href={`/${slug}/problems`} variant="ghost">
        Back to the {TEST_LABEL[test]} problems
      </ButtonLink>
    </>
  );
}

function testFocusHref(test: StdTest) {
  return (state: ExamState, entry: GroupResult): string | null => {
    if (state.kind === 'mock') return sectionTestHref(test, entry.id);
    return `/${TEST_SLUG[test]}/problems?skill=${encodeURIComponent(entry.id)}`;
  };
}

export function TestMockApp({ test }: { test: StdTest }) {
  return (
    <ExamSession
      slot={`${TEST_SLUG[test]}-mock`}
      renderStart={(api) => <TestMockStart test={test} api={api} />}
      renderActions={(state, again) => <TestActions test={test} state={state} again={again} />}
      focusHref={testFocusHref(test)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* /sat/section and /act/section                                               */
/* -------------------------------------------------------------------------- */

function TestSectionStart({ test, api }: { test: StdTest; api: StartScreenApi }) {
  const { data, failed } = useStaticData(loaders[test]);
  const params = useQueryParams();
  const [domain, setDomain] = useState('');

  useEffect(() => {
    const fromLink = params?.get('domain');
    if (fromLink) setDomain(fromLink.toUpperCase());
  }, [params]);

  const domains = useMemo(() => data?.domains ?? [], [data]);
  const chosen = domains.some((d) => d.id === domain) ? domain : (domains[0]?.id ?? '');
  const rows = useMemo(() => (data ? testSectionRows(data.rows, chosen) : []), [data, chosen]);

  if (!data) return <StartStatus loading={!failed} failed={failed} />;
  const label = TEST_LABEL[test];
  const noun = EXAM_SPECS[test].sectionNoun;
  const name = domains.find((d) => d.id === chosen)?.name ?? chosen;

  return (
    <SectionPicker
      title={`Choose a ${noun}`}
      intro={
        <p className="m-0">
          {SECTION_TEST_SIZE} questions from one {label} {noun}, easy to hard, timed from how long
          each one usually takes. One point per right answer. At least {SECTION_TEST_MIN} questions
          are needed for a test.
        </p>
      }
      api={api}
      bankHref={`/${TEST_SLUG[test]}/problems`}
      available={rows.length}
      sectionName={name}
      fields={[
        {
          id: `${TEST_SLUG[test]}-section-domain`,
          label: noun.charAt(0).toUpperCase() + noun.slice(1),
          value: chosen,
          options: domains.map((d) => ({ value: d.id, label: `${d.name} (${d.count})` })),
          onChange: setDomain,
        },
      ]}
      onStart={() => {
        const seed = newSeed();
        const { problemIds } = buildSectionPaper(rows, SECTION_TEST_SIZE, seed);
        if (problemIds.length < SECTION_TEST_MIN) return;
        api.begin({
          kind: 'section',
          exam: test,
          section: chosen,
          title: `${label} section test: ${name}`,
          seed,
          problemIds,
          modules: 'section',
          labels: domainLabels(data),
        });
      }}
    />
  );
}

export function TestSectionApp({ test }: { test: StdTest }) {
  return (
    <ExamSession
      slot={`${TEST_SLUG[test]}-section`}
      renderStart={(api) => <TestSectionStart test={test} api={api} />}
      renderActions={(state, again) => <TestActions test={test} state={state} again={again} />}
      focusHref={testFocusHref(test)}
    />
  );
}
