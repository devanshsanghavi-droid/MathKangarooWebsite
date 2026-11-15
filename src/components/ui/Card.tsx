import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cx } from './cx';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export interface CardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** The element to render. `section` and `article` are common; default `div`. */
  as?: ElementType;
  padding?: CardPadding;
  /**
   * Adds a hover lift and a strong border for a card that is itself a link or button target
   * (the whole card is clickable). Focus is still drawn by the global :focus-visible ring.
   */
  interactive?: boolean;
  children?: ReactNode;
}

/**
 * The basic v3 surface (docs/06 §1): --surface on --ground, a hairline --rule border, a
 * --shadow-1 lift and the 12px card radius. Everything app-like on the site sits on one.
 */
export function Card({
  as: Tag = 'div',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(
        'rounded-card border border-rule bg-surface shadow-xs',
        PADDING[padding],
        interactive &&
          'transition-[border-color,box-shadow] hover:border-rule-strong hover:shadow-lg motion-reduce:transition-none',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Heading level for the title. Default 2. */
  level?: 2 | 3 | 4;
  /** id for the heading, so a parent can point aria-labelledby at it. */
  titleId?: string;
  description?: ReactNode;
  /** Buttons or links aligned to the right of the title. */
  actions?: ReactNode;
  className?: string;
}

/** Title row for a Card: heading, optional one-line description, optional actions. */
export function CardHeader({
  title,
  level = 2,
  titleId,
  description,
  actions,
  className,
}: CardHeaderProps) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Heading id={titleId} className="ui m-0 text-base font-semibold text-ink">
          {title}
        </Heading>
        {description ? <p className="ui m-0 mt-1 text-xs text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
