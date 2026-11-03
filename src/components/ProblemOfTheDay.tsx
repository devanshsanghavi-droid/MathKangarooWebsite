'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { DifficultyPill } from '@/components/DifficultyPill';
import { BandPill } from '@/components/BandPill';
import { dayNumber, formatDay } from '@/lib/potd';
import type { Band, Points } from '@/lib/schemas';

export interface PotdCandidate {
  id: string;
  points: Points;
  band: Band;
  statement: string;
  skillName: string | null;
}

const noop = () => () => {};

/**
 * Problem of the Day, picked in the reader's browser.
 *
 * It used to be picked on the server with `revalidate = 3600`. On Cloudflare the page cache is
 * the read-only static-assets cache, so revalidation can never write: the card and its date
 * froze at whatever day the site was last deployed, and every request after the first hour
 * spent CPU on a revalidation that was bound to fail. Picking here keeps the page fully static.
 *
 * The server renders the build day's pick (the server snapshot), so hydration matches; the
 * client snapshot then moves it to today. The pick is the same pure function of the date as
 * before, so everyone still sees the same problem on the same day.
 */
export function ProblemOfTheDay({
  candidates,
  buildDay,
}: {
  candidates: readonly PotdCandidate[];
  buildDay: number;
}) {
  const day = useSyncExternalStore(
    noop,
    () => dayNumber(new Date()),
    () => buildDay,
  );
  if (candidates.length === 0) return null;
  const potd = candidates[day % candidates.length];
  if (!potd) return null;

  return (
    <section aria-labelledby="potd-heading" className="mt-16">
      <h2 id="potd-heading" className="m-0 text-lg">
        Problem of the day
      </h2>
      <p className="mt-2 mb-4 text-sm text-ink-3">{formatDay(new Date(day * 86_400_000))}</p>
      <Link
        href={`/problem/${potd.id}`}
        className="block rounded-md border border-rule bg-surface p-5 no-underline hover:border-rule-strong"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="mono text-xs text-ink-3">{potd.id}</span>
          <DifficultyPill points={potd.points} />
          <BandPill band={potd.band} />
          {potd.skillName ? <span className="text-sm text-ink-2">{potd.skillName}</span> : null}
        </span>
        <span className="statement prose-measure mt-3 block text-ink">{potd.statement}</span>
      </Link>
      <p className="mt-3 mb-0 text-xs text-ink-3">
        A different problem every day, the same one for everyone. The dated archive and the 6pm
        solution reveal arrive with <code className="mono">/potd</code> in Phase 2.
      </p>
    </section>
  );
}
