'use client';

import Link from 'next/link';
import { useProgress } from '@/components/mastery/useProgress';
import { statusOfProblem } from '@/lib/progress-summary';
import { MASTERY_DISPLAY } from '@/lib/mastery-display';
import { DifficultyPill } from '@/components/DifficultyPill';
import { bandLabel } from '@/components/BandPill';
import type { Band, Points } from '@/lib/schemas';

export interface ProblemRow {
  id: string;
  band: Band;
  points: Points;
  statement: string;
  hasFigure: boolean;
  pValue: number | null;
  skillIds: string[];
  primarySkill: { id: string; name: string } | null;
  secondaryCount: number;
}

/**
 * The problem bank as a dense, scannable table.
 *
 * The previous list gave each problem a card with its full statement, which reads well at
 * twenty problems and becomes a wall at nearly two hundred. A table lets a student do what
 * they actually come here to do: find the unsolved 4-pointers in geometry, see at a glance
 * what they have already cleared, and get into one.
 *
 * The status column is the whole reason this is worth building. It reads from the same
 * localStorage progress the ladders write to, so the bank remembers what you have done with
 * no account - which is the rule in CLAUDE.md, not a limitation.
 *
 * Status uses the mastery ramp, never the reserved green/red/amber. A standing total is not
 * feedback on an answer, and docs/05 §2 keeps those three for the moment of answering.
 */
export function ProblemTable({ rows }: { rows: ProblemRow[] }) {
  const file = useProgress();

  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-rule">
      <table className="w-full border-collapse text-left">
        <caption className="visually-hidden">
          Problems, with your status, difficulty, level and the skill each one teaches.
        </caption>
        <thead>
          <tr className="border-b border-rule bg-surface-2">
            <th scope="col" className="mono px-3 py-2 text-2xs font-medium text-ink-3">
              <span className="visually-hidden">Status</span>
              <span aria-hidden="true">·</span>
            </th>
            <th
              scope="col"
              className="mono hidden px-3 py-2 text-2xs font-medium text-ink-3 sm:table-cell"
            >
              Id
            </th>
            <th scope="col" className="mono w-full px-3 py-2 text-2xs font-medium text-ink-3">
              Problem
            </th>
            <th scope="col" className="mono px-3 py-2 text-2xs font-medium text-ink-3">
              Difficulty
            </th>
            <th
              scope="col"
              className="mono hidden px-3 py-2 text-2xs font-medium text-ink-3 sm:table-cell"
            >
              Level
            </th>
            <th
              scope="col"
              className="mono hidden px-3 py-2 text-2xs font-medium text-ink-3 xl:table-cell"
            >
              Solve rate
            </th>
            <th
              scope="col"
              className="mono hidden px-3 py-2 text-2xs font-medium text-ink-3 lg:table-cell"
            >
              Skill
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = statusOfProblem(file, row.id, row.skillIds);
            const display = MASTERY_DISPLAY[status];
            const solved = status === 'mastered' || status === 'shaky';
            return (
              <tr key={row.id} className="border-b border-rule last:border-b-0 hover:bg-surface-2">
                <td className="px-3 py-2.5 align-top">
                  <span
                    aria-hidden="true"
                    data-status={status}
                    title={solved ? 'Solved' : status === 'seen' ? 'Attempted' : 'Not started'}
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-lg border border-rule-strong text-[9px] leading-none text-ink ${display.fill}`}
                  >
                    {display.icon}
                  </span>
                  <span className="visually-hidden">
                    {solved ? 'Solved' : status === 'seen' ? 'Attempted' : 'Not started'}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                  <Link
                    href={`/problem/${row.id}`}
                    className="mono text-xs whitespace-nowrap no-underline hover:underline"
                  >
                    {row.id}
                  </Link>
                </td>
                <td className="w-full px-3 py-2.5 align-top">
                  <span className="mono block text-2xs text-ink-3 sm:hidden">{row.id}</span>
                  <Link
                    href={`/problem/${row.id}`}
                    className="reading line-clamp-2 text-sm text-ink no-underline hover:underline"
                  >
                    {row.statement}
                  </Link>
                  {row.hasFigure ? <span className="mono text-2xs text-ink-3">figure</span> : null}
                </td>
                <td className="px-3 py-2.5 align-top whitespace-nowrap">
                  <DifficultyPill points={row.points} />
                </td>
                <td className="mono hidden px-3 py-2.5 align-top text-2xs whitespace-nowrap text-ink-2 sm:table-cell">
                  {bandLabel(row.band).replace('Level ', '')}
                </td>
                <td className="mono hidden px-3 py-2.5 align-top text-2xs text-ink-3 tabular-nums xl:table-cell xl:w-28">
                  {row.pValue === null
                    ? 'not yet calibrated'
                    : `${Math.round(row.pValue * 100)}% solve it`}
                </td>
                <td className="hidden px-3 py-2.5 align-top text-xs lg:table-cell lg:w-44">
                  {row.primarySkill ? (
                    <Link
                      href={`/skill/${row.primarySkill.id}`}
                      className="line-clamp-2 text-ink-2 no-underline hover:underline"
                    >
                      {row.primarySkill.name}
                    </Link>
                  ) : null}
                  {row.secondaryCount > 0 ? (
                    <span className="mono ml-1.5 text-2xs text-ink-3">+{row.secondaryCount}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
