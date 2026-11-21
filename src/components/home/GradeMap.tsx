'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from '@/components/AppLink';
import { EXAMS, examById, kaTrackForGrade, type Exam } from '@/lib/exams';
import { cx } from '@/components/ui';
import { Mascot } from './Mascot';

/** Grades on the map, 1 to 12. */
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Width of the mascot in px; the hop position is clamped so it never leaves the lane. */
const MASCOT_SIZE = 40;

/** Does this exam's grade range include the grade? */
export function examFitsGrade(exam: Exam, grade: number): boolean {
  return grade >= exam.grades.min && grade <= exam.grades.max;
}

/**
 * Where the mascot stands: the centre of the chosen grade's column, kept inside the lane. With
 * no grade chosen it waits at the left edge.
 */
function mascotLeft(grade: number | null): string {
  if (grade === null) return '0px';
  const centre = ((grade - 0.5) / GRADES.length) * 100;
  return `clamp(0px, calc(${centre}% - ${MASCOT_SIZE / 2}px), calc(100% - ${MASCOT_SIZE}px))`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The grade map (docs/08 item 6): grades 1 to 12 across, one bar per exam over the grades it
 * is usually taken in, read from the exam catalog so a new exam appears here by itself.
 *
 * Choosing a grade (ordinary toggle buttons with `aria-pressed`; arrow keys move between them)
 * highlights the exams that fit and lists them below with links, in a polite live region. The
 * kangaroo slides to the grade with a CSS transition and does one small hop (Web Animations,
 * so no global keyframes); under `prefers-reduced-motion` it simply appears there.
 *
 * At 360px the twelve grades wrap into two rows of six (44px targets) and each exam's name sits
 * above its bar, so nothing scrolls sideways. From the `md` breakpoint the grades, the lane and
 * the bars share one twelve-column track and line up.
 */
export function GradeMap({ exams = EXAMS }: { exams?: readonly Exam[] }) {
  const [grade, setGrade] = useState<number | null>(null);
  const hopRef = useRef<HTMLSpanElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hopRef.current;
    if (grade === null || !el || typeof el.animate !== 'function' || prefersReducedMotion()) {
      return;
    }
    el.animate(
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-14px)', offset: 0.45 },
        { transform: 'translateY(0)' },
      ],
      { duration: 450, easing: 'ease-out' },
    );
  }, [grade]);

  const matching = grade === null ? [] : exams.filter((exam) => examFitsGrade(exam, grade));
  const live = matching.filter((exam) => exam.status === 'live');
  const soon = matching.filter((exam) => exam.status === 'soon');

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = [...(groupRef.current?.querySelectorAll('button') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = current + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  const row = 'grid gap-1.5 md:grid-cols-[8.5rem_minmax(0,1fr)] md:items-center md:gap-x-4';

  return (
    <section aria-labelledby="grade-map-heading" className="grid gap-6">
      <div className="text-center">
        <h2 id="grade-map-heading" className="m-0 text-2xl sm:text-3xl">
          Which exams fit your grade?
        </h2>
        <p className="mx-auto mt-2 mb-0 max-w-md text-base text-ink-2">
          Choose a grade to see the exams students usually take in it.
        </p>
      </div>

      <div className="rounded-[24px] border border-rule bg-surface px-4 py-6 shadow-xs sm:px-8 sm:py-8">
        <div className={row}>
          <p id="grade-map-grades" className="ui m-0 text-xs font-semibold text-ink-2">
            Grade
          </p>
          <div
            ref={groupRef}
            role="group"
            aria-labelledby="grade-map-grades"
            onKeyDown={onKeyDown}
            className="grid grid-cols-6 gap-2 md:grid-cols-12 md:gap-1.5"
          >
            {GRADES.map((g) => {
              const selected = grade === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setGrade(selected ? null : g)}
                  className={cx(
                    'ui tap-target flex cursor-pointer items-center justify-center rounded-control border-2 text-base font-semibold tabular-nums transition-colors motion-reduce:transition-none',
                    selected
                      ? 'border-accent-600 bg-accent-600 text-on-accent'
                      : 'border-rule-strong bg-surface text-ink hover:border-accent-600',
                  )}
                >
                  <span className="visually-hidden">Grade </span>
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* The lane the kangaroo hops along, over the same twelve columns as the bars. */}
        <div className={cx(row, 'mt-3')} aria-hidden="true">
          <span className="hidden md:block" />
          <div className="relative h-11">
            <span
              data-testid="grade-map-mascot"
              data-grade={grade ?? ''}
              className="absolute bottom-0 transition-[left] duration-500 ease-out motion-reduce:transition-none"
              style={{ left: mascotLeft(grade) }}
            >
              <span ref={hopRef} className="block">
                <Mascot size={MASCOT_SIZE} />
              </span>
            </span>
          </div>
        </div>

        <ul className="m-0 mt-2 grid list-none gap-3 p-0" aria-label="Exams by grade">
          {exams.map((exam) => {
            const fits = grade !== null && examFitsGrade(exam, grade);
            const dimmed = grade !== null && !fits;
            const isSoon = exam.status === 'soon';
            return (
              <li key={exam.id} className={row} data-exam={exam.id} data-highlighted={fits}>
                <p className="ui m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <Link
                    href={exam.routes.page}
                    className={cx(
                      'no-underline hover:underline',
                      fits ? 'font-semibold text-ink' : isSoon ? 'text-ink-3' : 'text-ink-2',
                    )}
                  >
                    {exam.shortName}
                  </Link>
                  <span className="text-2xs text-ink-3">
                    {isSoon ? 'Soon, grades' : 'Grades'} {exam.grades.min}-{exam.grades.max}
                  </span>
                </p>
                <div
                  aria-hidden="true"
                  className="relative grid h-4 grid-cols-12 overflow-hidden rounded-pill bg-surface-2"
                >
                  {grade !== null ? (
                    <span
                      className="row-start-1 h-full bg-accent-100"
                      style={{ gridColumn: `${grade} / ${grade + 1}` }}
                    />
                  ) : null}
                  <span
                    className={cx(
                      'row-start-1 h-full rounded-pill transition-opacity motion-reduce:transition-none',
                      exam.classes.bg,
                      isSoon && 'opacity-50',
                      dimmed && 'opacity-25',
                    )}
                    style={{ gridColumn: `${exam.grades.min} / ${exam.grades.max + 1}` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-rule pt-5" aria-live="polite">
          {grade === null ? (
            <p className="m-0 text-center text-sm text-ink-3">
              Choose a grade above to see which exams fit.
            </p>
          ) : (
            <GradeResult grade={grade} live={live} soon={soon} />
          )}
        </div>
      </div>
    </section>
  );
}

function GradeResult({
  grade,
  live,
  soon,
}: {
  grade: number;
  live: readonly Exam[];
  soon: readonly Exam[];
}) {
  const track = kaTrackForGrade(grade);
  return (
    <div data-testid="grade-map-result">
      <p className="ui m-0 text-sm font-semibold text-ink">
        In grade {grade}: {live.length + soon.length}{' '}
        {live.length + soon.length === 1 ? 'exam' : 'exams'}
      </p>
      <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
        {live.map((exam) => (
          <li key={exam.id}>
            <Link
              href={exam.routes.page}
              className={cx(
                'ui flex min-h-11 items-center gap-3 rounded-control border border-rule border-l-4 bg-surface px-3 py-2 text-sm no-underline hover:bg-surface-2',
                exam.classes.border,
              )}
            >
              <span className="font-semibold text-ink">{exam.name}</span>
              {exam.id === 'ka' && track ? (
                <span className="text-xs text-ink-2">{track.label}</span>
              ) : null}
            </Link>
          </li>
        ))}
        {soon.map((exam) => {
          const related = exam.related ? examById(exam.related) : undefined;
          return (
            <li key={exam.id}>
              <Link
                href={exam.routes.page}
                className="ui flex min-h-11 flex-wrap items-center gap-x-3 rounded-control border border-dashed border-rule-strong px-3 py-2 text-sm text-ink-2 no-underline hover:bg-surface-2"
              >
                <span>{exam.name}</span>
                <span className="text-xs text-ink-3">
                  Coming soon{related ? `. Try ${related.shortName} meanwhile.` : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
