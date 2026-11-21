'use client';

import { useSyncExternalStore } from 'react';

/**
 * The page's query string, read in the browser (docs/06: static pages never read
 * searchParams on the server). Re-renders on back / forward and whenever setSearchParam
 * changes the URL, which it does with replaceState so the filter never adds history entries.
 */

const EVENT = 'progress:search';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
}

/** Sets (or, with null, removes) one query parameter in place, keeping the rest. */
export function setSearchParam(name: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(EVENT));
}
