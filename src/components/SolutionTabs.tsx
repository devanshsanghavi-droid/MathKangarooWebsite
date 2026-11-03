'use client';

import { useId, useRef, useState } from 'react';

type TabId = 'reliable' | 'elegant';

/**
 * The two ways to solve a problem.
 *
 * "Reliable" is the method that always works under time pressure. "Elegant" is the insight,
 * where there is one - `docs/03-CONTENT-GUIDE.md` B5 says to state plainly when there is not,
 * so a null elegant solution removes the tab rather than showing an empty panel.
 *
 * Both panels are always in the DOM; the inactive one carries `hidden`. The <noscript> block
 * un-hides it, so a reader without JavaScript sees both solutions stacked instead of one
 * unreachable tab. The whole block sits inside a <details> because a solution on screen before
 * the student has tried is not a solution, it is an answer key.
 */
export function SolutionTabs({
  reliable,
  elegant,
  defaultOpen = false,
}: {
  reliable: string;
  elegant: string | null;
  defaultOpen?: boolean;
}) {
  const base = useId();
  const [active, setActive] = useState<TabId>('reliable');
  const tabsRef = useRef<HTMLDivElement>(null);

  const tabs: Array<{ id: TabId; label: string; body: string }> = [
    { id: 'reliable', label: 'The reliable way', body: reliable },
    ...(elegant ? [{ id: 'elegant' as const, label: 'The elegant way', body: elegant }] : []),
  ];

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (tabs.length < 2) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order = tabs.map((tab) => tab.id);
    const at = order.indexOf(active);
    let next = at;
    if (event.key === 'ArrowRight') next = (at + 1) % order.length;
    if (event.key === 'ArrowLeft') next = (at - 1 + order.length) % order.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = order.length - 1;
    const id = order[next];
    if (!id) return;
    setActive(id);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#${base}-tab-${id}`)?.focus();
  }

  return (
    <details open={defaultOpen} className="mt-6 rounded-sm border border-rule bg-surface px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold text-ink marker:text-ink-3">
        Solution
        {elegant ? null : (
          <span className="ml-2 text-xs font-normal text-ink-3"> - no shortcut on this one</span>
        )}
      </summary>

      <noscript>
        {/* Without JavaScript the tabs cannot switch, so show every panel instead of hiding one. */}
        <style>{`.ka-solution-panel[hidden]{display:block !important}.ka-solution-tabs{display:none}`}</style>
      </noscript>

      {tabs.length > 1 ? (
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Solution methods"
          onKeyDown={handleKeyDown}
          className="ka-solution-tabs mt-3 flex gap-1 border-b border-rule"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={[
                'cursor-pointer rounded-t-xs px-3 py-1.5 text-sm transition-colors',
                active === tab.id
                  ? 'border-b-2 border-accent-600 font-medium text-ink'
                  : 'border-b-2 border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="ka-solution-panel"
          {...(tabs.length > 1
            ? {
                role: 'tabpanel',
                id: `${base}-panel-${tab.id}`,
                'aria-labelledby': `${base}-tab-${tab.id}`,
                tabIndex: 0,
              }
            : {})}
          hidden={tabs.length > 1 && active !== tab.id}
        >
          {tabs.length > 1 ? (
            <h4 className="ka-solution-heading mt-3 mb-0 text-xs font-semibold text-ink-3">
              {tab.label}
            </h4>
          ) : null}
          <p className="prose-measure mt-2 mb-2 text-sm text-ink-2">{tab.body}</p>
        </div>
      ))}
    </details>
  );
}
