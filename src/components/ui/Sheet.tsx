'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Visible title; also the dialog's accessible name. */
  title: ReactNode;
  /** `bottom` for the mobile filter sheet; `left` / `right` for a drawer. Default `bottom`. */
  side?: 'bottom' | 'left' | 'right';
  /** Sticky actions at the bottom, e.g. "Show 120 problems". */
  footer?: ReactNode;
  /** Label of the close button. Default "Close". */
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const SIDE: Record<NonNullable<SheetProps['side']>, string> = {
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card border-t',
  left: 'inset-y-0 left-0 w-[min(90vw,360px)] border-r',
  right: 'inset-y-0 right-0 w-[min(90vw,360px)] border-l',
};

/**
 * A modal sheet: the mobile "Filters" panel for the question bank (docs/06 §4), or a side
 * drawer. role="dialog" aria-modal, focus moved in on open and returned to the opener on
 * close, Tab cycled inside, Escape and the scrim close it, and the page behind does not
 * scroll. Renders nothing while closed. Written out rather than taken from a library because
 * it is short and the dependency budget is deliberately small.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'bottom',
  footer,
  closeLabel = 'Close',
  className,
  children,
}: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="no-print fixed inset-0 z-50" onKeyDown={onKeyDown}>
      {/* The scrim closes on click but is not a tab stop: the close button is the keyboard path. */}
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-scrim"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'ui absolute flex flex-col border-rule bg-surface shadow-lg',
          SIDE[side],
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
          <h2 id={titleId} className="m-0 text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-target cursor-pointer rounded-control px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {closeLabel}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="border-t border-rule px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
