'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface AccordionProps {
  className?: string;
  children: ReactNode;
}

/**
 * A stack of AccordionItems. Adds the optional WAI-ARIA accordion keys on top of what each
 * header button already does (Enter / Space toggle): ArrowDown / ArrowUp move between headers,
 * Home / End jump to the first and last.
 */
export function Accordion({ className, children }: AccordionProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-accordion-trigger')) return;
    const triggers = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger]'),
    ];
    const index = triggers.indexOf(target as HTMLButtonElement);
    if (index === -1) return;
    const last = triggers.length - 1;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowDown'
            ? (index + 1) % triggers.length
            : (index - 1 + triggers.length) % triggers.length;
    event.preventDefault();
    triggers[next]?.focus();
  }

  return (
    <div className={cx('divide-y divide-rule', className)} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export interface AccordionItemProps {
  /** The header text. */
  title: ReactNode;
  /** Right-aligned header detail, e.g. "4 / 18". Read after the title. */
  meta?: ReactNode;
  /** Heading level wrapping the trigger button. Default 3. */
  level?: 2 | 3 | 4 | 5 | 6;
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Controlled state; pair with onOpenChange. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Something before the title in the header, e.g. a strand-level checkbox. Not inside the button. */
  leading?: ReactNode;
  className?: string;
  /** Classes for the panel body. */
  panelClassName?: string;
  children: ReactNode;
}

/**
 * One collapsible section. The header is a <button aria-expanded aria-controls> inside a
 * heading, and the body is a role="region" labelled by that button and `hidden` while shut,
 * so closed content is out of the tab order and the accessibility tree.
 */
export function AccordionItem({
  title,
  meta,
  level = 3,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  leading,
  className,
  panelClassName,
  children,
}: AccordionItemProps) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  function toggle() {
    const next = !open;
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cx('py-0.5', className)}>
      <div className="flex items-center gap-1">
        {leading}
        <Heading className="m-0 min-w-0 flex-1 text-sm">
          <button
            id={triggerId}
            type="button"
            data-accordion-trigger=""
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
            className="ui flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-control px-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">{title}</span>
            {meta !== undefined ? (
              <span className="mono shrink-0 text-2xs font-normal text-ink-3 tabular-nums">
                {meta}
              </span>
            ) : null}
            <Chevron open={open} />
          </button>
        </Heading>
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className={cx('pb-2', panelClassName)}
      >
        {children}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={cx(
        'shrink-0 text-ink-3 transition-transform motion-reduce:transition-none',
        open && 'rotate-180',
      )}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
