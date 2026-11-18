'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { loadKaIndex, loadKaLookups } from '@/lib/bank-client';
import type { KaIndexFile, KaLookups } from '@/lib/bank-data';
import { readLevel } from '@/lib/level-pref';
import type { Band } from '@/lib/schemas';
import {
  SECTION_TEST_MIN,
  SECTION_TEST_SIZE,
  type ExamState,
  type GroupResult,
} from '@/lib/exam-engine';
import { buildSectionPaper, kaSectionRows, newSeed } from '@/lib/exam-papers';
import { ExamSession, type StartScreenApi } from './ExamSession';
import { SectionPicker, StartStatus, useQueryParams, useStaticData } from './start-ui';

const loadKa = () => Promise.all([loadKaIndex(), loadKaLookups()]);

function KaSectionStart({ api }: { api: StartScreenApi }) {
  const { data, failed } = useStaticData(loadKa);
  const params = useQueryParams();
  const [band, setBand] = useState<string>('');
  const [strand, setStrand] = useState<string>('');

  // A link names the strand (and maybe the level); otherwise the level the student told the
  // Practice home they sit.
  useEffect(() => {
    if (!params) return;
    const fromLink = params.get('level') ?? params.get('band');
    const remembered = readLevel();
    if (fromLink) setBand(fromLink);
    else if (remembered) setBand(remembered);
    const strandFromLink = params.get('strand');
    if (strandFromLink) setStrand(strandFromLink.toUpperCase());
  }, [params]);

  const [index, lookups] = (data ?? [null, null]) as [KaIndexFile | null, KaLookups | null];
  const bands = useMemo(() => lookups?.bands ?? [], [lookups]);
  const strands = useMemo(() => lookups?.strands ?? [], [lookups]);
  const chosenBand = (bands as readonly string[]).includes(band) ? (band as Band) : bands[0];
  const chosenStrand = strands.some((s) => s.id === strand) ? strand : (strands[0]?.id ?? '');
  const rows = useMemo(
    () => (index && chosenBand ? kaSectionRows(index.rows, chosenBand, chosenStrand) : []),
    [index, chosenBand, chosenStrand],
  );

  if (!index || !lookups || !chosenBand) return <StartStatus loading={!failed} failed={failed} />;
  const strandName = strands.find((s) => s.id === chosenStrand)?.name ?? chosenStrand;

  return (
    <SectionPicker
      title="Choose a level and a strand"
      intro={
        <p className="m-0">
          {SECTION_TEST_SIZE} problems from one strand at your level, spread over 3, 4 and 5 points
          and timed from how long each one usually takes. Scored like the real paper: each problem
          is worth its points, and a wrong answer costs nothing. At least {SECTION_TEST_MIN}{' '}
          problems are needed for a test.
        </p>
      }
      api={api}
      bankHref={`/problems?level=${chosenBand}`}
      available={rows.length}
      sectionName={`Level ${chosenBand}, ${strandName}`}
      fields={[
        {
          id: 'ka-section-level',
          label: 'Level',
          value: chosenBand,
          options: bands.map((b) => ({ value: b, label: `Level ${b}` })),
          onChange: setBand,
        },
        {
          id: 'ka-section-strand',
          label: 'Strand',
          value: chosenStrand,
          options: strands.map((s) => ({ value: s.id, label: s.name })),
          onChange: setStrand,
        },
      ]}
      onStart={() => {
        const seed = newSeed();
        const { problemIds } = buildSectionPaper(rows, SECTION_TEST_SIZE, seed);
        if (problemIds.length < SECTION_TEST_MIN) return;
        api.begin({
          kind: 'section',
          exam: 'KA',
          section: chosenStrand,
          title: `Section test: ${strandName}, Level ${chosenBand}`,
          seed,
          problemIds,
          modules: 'section',
          labels: Object.fromEntries(strands.map((s) => [s.id, s.name])),
        });
      }}
    />
  );
}

function KaActions({ again }: { again: () => void }) {
  return (
    <>
      <Button variant="primary" onClick={again}>
        Take another section test
      </Button>
      <ButtonLink href="/practice/mock" variant="secondary">
        Sit a full mock
      </ButtonLink>
      <ButtonLink href="/problems" variant="ghost">
        Back to the question bank
      </ButtonLink>
    </>
  );
}

/** A section test's weak skills link to the skill's own unit page. */
function kaFocusHref(_state: ExamState, entry: GroupResult): string {
  return `/skill/${entry.id}`;
}

export function KaSectionApp() {
  return (
    <ExamSession
      slot="ka-section"
      renderStart={(api) => <KaSectionStart api={api} />}
      renderActions={(_state, again) => <KaActions again={again} />}
      focusHref={kaFocusHref}
    />
  );
}
