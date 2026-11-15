import type { ReactNode } from 'react';
import { cx } from './cx';

export interface PageContainerProps {
  /** `app` is the 1200px app column (docs/06 §2); `reading` keeps the 720px prose column. */
  width?: 'app' | 'reading';
  className?: string;
  children: ReactNode;
}

/** The page-level container every v3 route sits in. Gutters match the top bar. */
export function PageContainer({ width = 'app', className, children }: PageContainerProps) {
  return (
    <div
      className={cx(
        'mx-auto w-full px-4 py-6 sm:px-6 sm:py-8',
        width === 'app' ? 'max-w-app' : 'max-w-[var(--content-width)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Small line above the title, e.g. "Question bank" or a BetaBadge. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (primary button, etc.). */
  actions?: ReactNode;
  className?: string;
}

/** The page's single h1 with its description and actions. */
export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cx('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 max-w-prose">
        {eyebrow ? (
          <div className="ui mb-2 flex items-center gap-2 text-xs font-semibold text-ink-2">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="m-0 text-2xl sm:text-3xl">{title}</h1>
        {description ? <p className="m-0 mt-2 text-base text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
