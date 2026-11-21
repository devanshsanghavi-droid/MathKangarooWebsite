'use client';

import { useMemo } from 'react';
import { useProgress } from '@/components/mastery/useProgress';
import {
  bankEvents,
  percentLabel,
  sectionStats,
  type BankSpec,
  type Tally,
} from '@/lib/progress-analytics';
import type { ProgressFile } from '@/lib/local-progress';
import type { ExamTopicRow } from './exam-page-data';

export interface ExamTopicsProps {
  rows: readonly ExamTopicRow[];
  /** The bank description for the accuracy column (built at build time). */
  spec: BankSpec | null;
  /** "Strand", "Area", "Domain": the column heading. */
  noun: string;
  /** Kangaroo: count only answers to this level's problems. */
  level?: string | null;
  /** For tests: a fixed file instead of this browser's. */
  file?: ProgressFile;
}

/**
 * The topics table on an exam page (docs/08 item 3): each topic with its question count, baked
 * in at build time, and the student's own accuracy in it, read from this browser's progress
 * file after hydration (ProgressSync keeps that file in step with the account copy). The
 * server render shows every topic as not tried, so the static HTML is the same for everyone.
 */
export function ExamTopics({ rows, spec, noun, level = null, file }: ExamTopicsProps) {
  const stored = useProgress();
  const progress = file ?? stored;

  const tallies = useMemo(() => {
    const out = new Map<string, Tally>();
    if (!spec) return out;
    const events = bankEvents(progress, spec).filter(
      (event) => level === null || event.meta === level,
    );
    for (const stat of sectionStats(events, spec)) out.set(stat.id, stat);
    return out;
  }, [progress, spec, level]);

  if (rows.length === 0) {
    return <p className="m-0 text-sm text-ink-2">No questions here yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="ui border-b border-rule text-left text-xs text-ink-2">
          <th scope="col" className="py-2 pr-3 font-semibold">
            {noun}
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-semibold">
            Questions
          </th>
          <th scope="col" className="py-2 text-right font-semibold">
            Your accuracy
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const tally = tallies.get(row.id);
          const tried = tally !== undefined && tally.attempts > 0;
          return (
            <tr key={row.id} className="border-b border-rule last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                {row.name}
              </th>
              <td className="py-2 pr-3 text-right text-ink-2 tabular-nums">
                {row.count.toLocaleString('en-US')}
              </td>
              <td className="py-2 text-right tabular-nums">
                {tried ? (
                  <>
                    <span className="font-semibold text-ink">{percentLabel(tally.accuracy)}</span>
                    <span className="block text-xs text-ink-3">
                      {tally.correct} of {tally.attempts} right
                    </span>
                  </>
                ) : (
                  <span className="text-ink-3">Not tried yet</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
