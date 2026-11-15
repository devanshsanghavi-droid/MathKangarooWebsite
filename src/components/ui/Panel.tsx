import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps {
  /** Visible heading. When given, the panel is a <section> labelled by it. */
  title?: ReactNode;
  /** Heading level. Default 2. */
  level?: 2 | 3 | 4;
  description?: ReactNode;
  /** Controls aligned with the heading (a "See all" link, a toggle). */
  actions?: ReactNode;
  /** Visually: `card` (surface, border, shadow) or `plain` (no chrome, just the spacing). */
  variant?: 'card' | 'plain';
  className?: string;
  children?: ReactNode;
}

/**
 * An airy titled region (docs/06 §1: "tables and lists are compact, panels are airy"). Use it
 * for a home-page block, a sidebar group or a results summary. With a title it renders a
 * <section aria-labelledby>, so it appears in a screen reader's region list under that name.
 */
export function Panel({
  title,
  level = 2,
  description,
  actions,
  variant = 'card',
  className,
  children,
}: PanelProps) {
  const headingId = useId();
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  const Tag = title ? 'section' : 'div';

  return (
    <Tag
      aria-labelledby={title ? headingId : undefined}
      className={cx(
        variant === 'card' && 'rounded-card border border-rule bg-surface p-5 shadow-xs sm:p-6',
        className,
      )}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <Heading id={headingId} className="ui m-0 text-lg font-semibold text-ink">
                {title}
              </Heading>
            ) : null}
            {description ? <p className="ui m-0 mt-1 text-sm text-ink-2">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
