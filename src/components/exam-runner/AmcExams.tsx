'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { loadAmcIndex, loadAmcLookups } from '@/lib/bank-client';
import type { AmcIndexFile, AmcLookups } from '@/lib/bank-data';
import { AMC_FORMULA_CONTESTS, amcContestLabel, type AmcFormulaContest } from '@/lib/amc-tier';
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
  AMC_PAPER_SIZE,
  amcPaperPool,
  amcSectionRows,
  buildAmcMockPaper,
  buildSectionPaper,
  newSeed,
} from '@/lib/exam-papers';
import { ExamSession, type StartScreenApi } from './ExamSession';
import {
  PaperChooser,
  SectionPicker,
  StartStatus,
  useQueryParams,
  useStaticData,
} from './start-ui';

const loadAmc = () => Promise.all([loadAmcIndex(), loadAmcLookups()]);

function isPaper(value: string | null | undefined): value is AmcFormulaContest {
  return (AMC_FORMULA_CONTESTS as readonly string[]).includes(value ?? '');
}

function areaLabels(lookups: AmcLookups): Record<string, string> {
  return Object.fromEntries(lookups.areas.map((area) => [area.id, area.name]));
}

function scoringDetail(paper: AmcFormulaContest): string {
  const spec = EXAM_SPECS[paper];
  const base = `${mockQuestionCount(spec)} questions, ${mockMinutes(spec)} minutes`;
  return paper === 'AMC8'
    ? `${base}, 1 point per right answer`
    : `${base}, 6 per right answer, 1.5 per blank`;
}

/* -------------------------------------------------------------------------- */
/* /amc/mock                                                                   */
/* -------------------------------------------------------------------------- */

function AmcMockStart({ api }: { api: StartScreenApi }) {
  const { data, failed } = useStaticData(loadAmc);
  const params = useQueryParams();
  if (!data) return <StartStatus loading={!failed} failed={failed} />;
  const [index, lookups] = data as [AmcIndexFile, AmcLookups];
  const suggested = params?.get('contest');

  return (
    <PaperChooser
      title="Choose a paper"
      intro={
        <p className="m-0">
          One original problem for every position on the real paper, easiest first, in the real
          time. AMC 10 and AMC 12 score 6 for a right answer, 1.5 for a blank and nothing for a
          wrong one, so a blind guess is worth less than a blank. AMC 8 scores 1 per right answer
          with nothing taken off.
        </p>
      }
      api={api}
      choices={AMC_FORMULA_CONTESTS.map((paper) => {
        const pool = amcPaperPool(index.rows, paper).length;
        const label = amcContestLabel(paper);
        return {
          id: paper,
          title: label,
          detail: scoringDetail(paper),
          suggested: suggested === paper,
          unavailable:
            pool >= AMC_PAPER_SIZE
              ? null
              : `The bank holds ${pool} of the ${AMC_PAPER_SIZE} ${label} problems a paper needs, so this one is not offered yet.`,
          onStart: () => {
            const seed = newSeed();
            const paperResult = buildAmcMockPaper(index.rows, paper, seed);
            if (paperResult.shortfall > 0) return;
            api.begin({
              kind: 'mock',
              exam: paper,
              title: `${label} mock`,
              seed,
              problemIds: paperResult.problemIds,
              modules: EXAM_SPECS[paper].mock ?? [],
              labels: areaLabels(lookups),
            });
          },
        };
      })}
    />
  );
}

function AmcActions({ state, again }: { state: ExamState; again: () => void }) {
  return (
    <>
      <Button variant="primary" onClick={again}>
        {state.kind === 'mock' ? 'Take another mock' : 'Take another section test'}
      </Button>
      <ButtonLink
        href={
          state.kind === 'mock' ? sectionTestHref(state.exam) : `/amc/mock?contest=${state.exam}`
        }
        variant="secondary"
      >
        {state.kind === 'mock' ? 'Take a section test' : 'Take a full mock'}
      </ButtonLink>
      <ButtonLink href="/amc/problems" variant="ghost">
        Back to the AMC problems
      </ButtonLink>
    </>
  );
}

function amcFocusHref(state: ExamState, entry: GroupResult): string | null {
  if (state.kind === 'mock') return sectionTestHref(state.exam, entry.id);
  return `/amc/problems?level=${state.exam}&topic=${encodeURIComponent(entry.id)}`;
}

export function AmcMockApp() {
  return (
    <ExamSession
      slot="amc-mock"
      renderStart={(api) => <AmcMockStart api={api} />}
      renderActions={(state, again) => <AmcActions state={state} again={again} />}
      focusHref={amcFocusHref}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* /amc/section                                                                */
/* -------------------------------------------------------------------------- */

function AmcSectionStart({ api }: { api: StartScreenApi }) {
  const { data, failed } = useStaticData(loadAmc);
  const params = useQueryParams();
  const [paper, setPaper] = useState<AmcFormulaContest>('AMC10');
  const [area, setArea] = useState<string>('');

  // A link from a report or the progress page names the paper and the area.
  useEffect(() => {
    if (!params) return;
    const contest = params.get('contest');
    if (isPaper(contest)) setPaper(contest);
    const fromLink = params.get('area');
    if (fromLink) setArea(fromLink);
  }, [params]);

  const lookups = data?.[1];
  const index = data?.[0];
  const areas = useMemo(() => lookups?.areas ?? [], [lookups]);
  const chosenArea = areas.some((a) => a.id === area) ? area : (areas[0]?.id ?? '');
  const rows = useMemo(
    () => (index ? amcSectionRows(index.rows, paper, chosenArea) : []),
    [index, paper, chosenArea],
  );

  if (!index || !lookups) return <StartStatus loading={!failed} failed={failed} />;
  const label = amcContestLabel(paper);
  const areaName = areas.find((a) => a.id === chosenArea)?.name ?? chosenArea;

  return (
    <SectionPicker
      title="Choose a paper and an area"
      intro={
        <p className="m-0">
          {SECTION_TEST_SIZE} problems from one area of one paper, spread from early to late slots
          and timed from how long each one usually takes. Scored the way that paper is scored. At
          least {SECTION_TEST_MIN} problems are needed for a test.
        </p>
      }
      api={api}
      bankHref={`/amc/problems?level=${paper}`}
      available={rows.length}
      sectionName={`${label}, ${areaName}`}
      fields={[
        {
          id: 'amc-section-paper',
          label: 'Paper',
          value: paper,
          options: AMC_FORMULA_CONTESTS.map((p) => ({ value: p, label: amcContestLabel(p) })),
          onChange: (value) => {
            if (isPaper(value)) setPaper(value);
          },
        },
        {
          id: 'amc-section-area',
          label: 'Area',
          value: chosenArea,
          options: areas.map((a) => ({ value: a.id, label: a.name })),
          onChange: setArea,
        },
      ]}
      onStart={() => {
        const seed = newSeed();
        const { problemIds } = buildSectionPaper(rows, SECTION_TEST_SIZE, seed);
        if (problemIds.length < SECTION_TEST_MIN) return;
        api.begin({
          kind: 'section',
          exam: paper,
          section: chosenArea,
          title: `${label} section test: ${areaName}`,
          seed,
          problemIds,
          modules: 'section',
          labels: areaLabels(lookups),
        });
      }}
    />
  );
}

export function AmcSectionApp() {
  return (
    <ExamSession
      slot="amc-section"
      renderStart={(api) => <AmcSectionStart api={api} />}
      renderActions={(state, again) => <AmcActions state={state} again={again} />}
      focusHref={amcFocusHref}
    />
  );
}
