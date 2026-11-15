'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Optional count after the label. */
  count?: number;
  content: ReactNode;
}

export interface TabsProps<T extends string = string> {
  /** Names the tab list, e.g. "Solutions". */
  label: string;
  tabs: ReadonlyArray<TabItem<T>>;
  /** Uncontrolled initial tab. Default the first. */
  defaultTab?: T;
  /** Controlled selection; pair with onChange. */
  value?: T;
  onChange?: (id: T) => void;
  className?: string;
  /** Classes for the tab panel. */
  panelClassName?: string;
}

/**
 * The WAI-ARIA tabs pattern with automatic activation: one tab stop, Left / Right (and Home /
 * End) move and select, Tab moves into the panel. The selected tab is marked by aria-selected,
 * a 2px teal underline and a heavier weight, never by colour alone.
 */
export function Tabs<T extends string = string>({
  label,
  tabs,
  defaultTab,
  value,
  onChange,
  className,
  panelClassName,
}: TabsProps<T>) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const [selectedState, setSelectedState] = useState<T | undefined>(defaultTab ?? tabs[0]?.id);
  const selected = value ?? selectedState;
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selected),
  );
  const current = tabs[selectedIndex];

  function select(index: number, focus: boolean) {
    const tab = tabs[index];
    if (!tab) return;
    if (value === undefined) setSelectedState(tab.id);
    onChange?.(tab.id);
    if (focus) list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = selectedIndex === last ? 0 : selectedIndex + 1;
    else if (event.key === 'ArrowLeft') next = selectedIndex === 0 ? last : selectedIndex - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <div className={cx('ui', className)}>
      <div
        ref={list}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-rule"
      >
        {tabs.map((tab, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={tab.id}
              id={`${id}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${id}-panel`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(index, false)}
              className={cx(
                '-mb-px inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap',
                isSelected
                  ? 'border-accent-600 font-semibold text-ink'
                  : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className="mono text-2xs text-ink-3 tabular-nums">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {current ? (
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${current.id}`}
          tabIndex={0}
          className={cx('pt-4', panelClassName)}
        >
          {current.content}
        </div>
      ) : null}
    </div>
  );
}
