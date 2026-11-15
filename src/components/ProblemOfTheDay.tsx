'use client';

import { useSyncExternalStore } from 'react';
import { DifficultyPill } from '@/components/DifficultyPill';
import { dayNumber, formatDay } from '@/lib/potd';
import type { Band, Points } from '@/lib/schemas';
import { ButtonLink, Card } from '@/components/ui';

export interface PotdCandidate {
  id: string;
  points: Points;
  band: Band;
  /** Plain text, already truncated for a preview. */
  statement: string;
  skillName: string | null;
}

const noop = () => () => {};

/**
 * Problem of the day, picked in the reader's browser so the page stays fully static.
 *
 * The pick is the same pure function of the date as `problemOfTheDay` in lib/potd.ts (the bank
 * in id order, indexed by the UTC day number), so everyone sees the same problem on the same day.
 * The server works that function out for a window of days starting at the build day and sends
 * only those picks, not the whole bank: with ~1,000 problems the full list of statements would
 * have been most of the home page's payload. The server renders the build day's pick, so
 * hydration matches; the client snapshot then moves it to today. If a deploy is older than the
 * window, the window simply repeats, which still gives one stable problem per day.
 */
export function ProblemOfTheDay({
  picks,
  startDay,
  headingLevel = 2,
  className,
}: {
  /** picks[i] is the problem for day `startDay + i`. */
  picks: readonly PotdCandidate[];
  startDay: number;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const day = useSyncExternalStore(
    noop,
    () => dayNumber(new Date()),
    () => startDay,
  );
  if (picks.length === 0) return null;
  const offset = (((day - startDay) % picks.length) + picks.length) % picks.length;
  const potd = picks[offset];
  if (!potd) return null;
  const Heading = `h${headingLevel}` as 'h2' | 'h3';

  return (
    <Card as="section" aria-labelledby="potd-heading" padding="lg" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading id="potd-heading" className="ui m-0 text-base font-semibold text-ink">
          Problem of the day
        </Heading>
        <p className="ui m-0 text-xs text-ink-3">{formatDay(new Date(day * 86_400_000))}</p>
      </div>
      <p className="ui mt-3 mb-0 flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <span className="mono text-ink-3">{potd.id}</span>
        <DifficultyPill points={potd.points} />
        <span className="mono rounded-pill border border-rule px-2 py-0.5 text-2xs">
          Level {potd.band}
        </span>
        {potd.skillName ? <span>{potd.skillName}</span> : null}
      </p>
      <p className="statement mt-3 mb-0 text-ink">{potd.statement}</p>
      <div className="mt-4">
        <ButtonLink href={`/problem/${potd.id}`} variant="secondary" size="md">
          Solve it
          <span className="visually-hidden"> (problem of the day, {potd.id})</span>
        </ButtonLink>
      </div>
      <p className="ui mt-3 mb-0 text-2xs text-ink-3">
        A different problem every day, the same one for everyone.
      </p>
    </Card>
  );
}
