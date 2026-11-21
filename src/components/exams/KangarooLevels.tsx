'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, ToggleChip } from '@/components/ui';
import { examById } from '@/lib/exams';
import type { BankSpec } from '@/lib/progress-analytics';
import type { ExamTopicRow } from './exam-page-data';
import { ExamActions, ExamFacts, countLabel, examTopEdge, gradesLabel } from './ExamBits';
import { ExamTopics } from './ExamTopics';

export interface KangarooLevelsProps {
  byTrack: Readonly<Record<string, ExamTopicRow[]>>;
  totalByTrack: Readonly<Record<string, number>>;
  spec: BankSpec | null;
}

/** The query parameter that mirrors the chosen level, e.g. /exams/ka?level=3-4. */
export const LEVEL_PARAM = 'level';

const KANGAROO = examById('ka');
const TRACKS = KANGAROO?.tracks ?? [];

/**
 * The Kangaroo exam page's level picker (docs/08 item 3). Kangaroo has six levels with their
 * own paper length, so choosing one switches the format facts, the links (the bank and the
 * section test open on that level) and the topics table (counts and the student's accuracy on
 * that level's questions).
 *
 * Client state, mirrored into the URL with history.replaceState so a link to a level works
 * and the page stays one static file: the query is read in the browser after hydration, never
 * on the server. The server render shows the first level.
 */
export function KangarooLevels({ byTrack, totalByTrack, spec }: KangarooLevelsProps) {
  const exam = KANGAROO;
  const tracks = TRACKS;
  const [level, setLevel] = useState<string>(tracks[0]?.id ?? '');

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get(LEVEL_PARAM);
    if (wanted && TRACKS.some((t) => t.id === wanted)) setLevel(wanted);
  }, []);

  const choose = useCallback((id: string) => {
    setLevel(id);
    const url = new URL(window.location.href);
    url.searchParams.set(LEVEL_PARAM, id);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  const track = tracks.find((t) => t.id === level) ?? tracks[0];
  if (!exam || !track) return null;
  const rows = byTrack[track.id] ?? [];
  const total = totalByTrack[track.id] ?? 0;

  return (
    <div className="grid gap-6">
      <div role="group" aria-label="Level" className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <ToggleChip key={t.id} pressed={t.id === track.id} onPressedChange={() => choose(t.id)}>
            {t.label}
          </ToggleChip>
        ))}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {`Showing ${track.label}: ${track.format.summary}.`}
      </p>

      <ExamActions exam={exam} bank={track.bank} level={track.id} />

      <Card as="section" aria-labelledby="exam-format" className={examTopEdge(exam)}>
        <h2 id="exam-format" className="m-0 mb-1 text-lg">
          Format: {track.label}
        </h2>
        <p className="m-0 mb-4 text-sm text-ink-2">
          {gradesLabel(track.grades)}. {countLabel(total, 'question')} in our bank at this level.
        </p>
        <ExamFacts format={track.format} scoring={track.scoring} eligibility={exam.eligibility} />
      </Card>

      <Card as="section" aria-labelledby="exam-topics">
        <h2 id="exam-topics" className="m-0 mb-1 text-lg">
          Topics at {track.label}
        </h2>
        <p className="m-0 mb-3 text-sm text-ink-2">
          Questions in our bank by strand, and your accuracy on this level&apos;s questions.
        </p>
        <ExamTopics rows={rows} spec={spec} noun="Strand" level={track.id} />
      </Card>
    </div>
  );
}
