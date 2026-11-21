import Link from '@/components/AppLink';
import { liveExams, soonExams } from '@/lib/exams';
import { cx } from '@/components/ui';

/**
 * One chip per exam, linking to its exam page (docs/08 item 5). Live exams are solid chips in
 * their own colour; coming-soon exams are quiet outlined chips after them, so they are there
 * to be found without competing with what can be practised today.
 */
export function ExamChips({
  label = 'Exam shortcuts',
  showSoon = true,
  className,
}: {
  /** The nav landmark's accessible name. */
  label?: string;
  showSoon?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
        {liveExams().map((exam) => (
          <li key={exam.id}>
            <Link
              href={exam.routes.page}
              className={cx(
                'ui inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-semibold no-underline transition-transform motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none',
                exam.classes.fill,
              )}
            >
              {exam.shortName}
            </Link>
          </li>
        ))}
        {showSoon
          ? soonExams().map((exam) => (
              <li key={exam.id}>
                <Link
                  href={exam.routes.page}
                  className="ui inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-dashed border-rule-strong bg-surface px-3 text-xs text-ink-2 no-underline hover:text-ink"
                >
                  {exam.shortName}
                  <span className="text-2xs text-ink-3">
                    <span className="visually-hidden">, coming </span>soon
                  </span>
                </Link>
              </li>
            ))
          : null}
      </ul>
    </nav>
  );
}
