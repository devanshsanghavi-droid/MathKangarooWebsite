'use client';

import Link from 'next/link';
import { useProgress } from '@/components/mastery/useProgress';
import { statusOfProblem } from '@/lib/progress-summary';
import { MASTERY_DISPLAY } from '@/lib/mastery-display';
import type { MasteryState } from '@/lib/mastery';
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
 * What a single problem's state is CALLED in the bank.
 *
 * The glyphs and fills are the mastery ramp's, but the words are not: on the skill rail ✓
 * means "three in a row across two days", which a single problem cannot be. Reusing "Mastered"
 * here would claim something about a skill from one answer, so a problem says what actually
 * happened to it.
 */
export const PROBLEM_STATUS_LABEL: Record<MasteryState, string> = {
  unseen: 'Not started',
  seen: 'Attempted, not solved',
  shaky: 'Solved after a miss',
  mastered: 'Solved first try',
};

const LEGEND_ORDER: MasteryState[] = ['unseen', 'seen', 'shaky', 'mastered'];

function StatusGlyph({ state }: { state: MasteryState }) {
  const display = MASTERY_DISPLAY[state];
  return (
    <span
      aria-hidden="true"
      data-status={state}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-rule-strong text-2xs leading-none ${display.fill} ${display.glyph}`}
    >
      {display.icon}
    </span>
  );
}

/** The key to the status column, so the four glyphs never have to be guessed. */
export function StatusLegend() {
  return (
    <ul
      aria-label="Status key"
      className="m-0 mt-4 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs text-ink-2"
    >
      {LEGEND_ORDER.map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <StatusGlyph state={state} />
          {PROBLEM_STATUS_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The problem bank as a dense, scannable table.
 *
 * A card per problem reads well at twenty problems and becomes a wall at three hundred. A
 * table lets a student do what they come here to do: find the unsolved 4-pointers in
 * geometry, see at a glance what they have already cleared, and get into one.
 *
 * The status column reads from the same localStorage progress the ladders and the problem page
 * write to, so the bank remembers what you have done with no account - which is the rule in
 * CLAUDE.md, not a limitation.
 *
 * Status uses the mastery ramp, never the reserved green/red/amber. A standing total is not
 * feedback on an answer, and docs/05 §2 keeps those three for the moment of answering.
 */
export function ProblemTable({
  rows,
  showSolveRate,
}: {
  rows: ProblemRow[];
  /** False while no problem is calibrated, rather than a column that says so on every row. */
  showSolveRate: boolean;
}) {
  const file = useProgress();

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-rule">
      <table className="w-full border-collapse text-left">
        <caption className="visually-hidden">
          Problems, with your status, difficulty, level and the skill each one teaches.
        </caption>
        <thead>
          <tr className="border-b border-rule bg-surface-2">
            <th scope="col" className="mono px-3 py-2 text-2xs font-medium text-ink-3">
              Status
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
            {showSolveRate ? (
              <th
                scope="col"
                className="mono hidden px-3 py-2 text-2xs font-medium text-ink-3 xl:table-cell"
              >
                Solve rate
              </th>
            ) : null}
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
            return (
              <tr
                key={row.id}
                className="border-b border-rule last:border-b-0 hover:shadow-[inset_3px_0_0_var(--accent-600)]"
              >
                <td className="px-3 py-2.5 align-top">
                  <StatusGlyph state={status} />
                  <span className="visually-hidden">{PROBLEM_STATUS_LABEL[status]}</span>
                </td>
                {/* Plain text: the statement beside it is the link, and one tab stop per row is enough. */}
                <td className="mono hidden px-3 py-2.5 align-top text-xs whitespace-nowrap text-ink-2 sm:table-cell">
                  {row.id}
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
                {showSolveRate ? (
                  <td className="mono hidden px-3 py-2.5 align-top text-2xs text-ink-3 tabular-nums xl:table-cell xl:w-28">
                    {row.pValue === null
                      ? 'not yet calibrated'
                      : `${Math.round(row.pValue * 100)}% solve it`}
                  </td>
                ) : null}
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
