'use client';

import { useSyncExternalStore } from 'react';
import { EMPTY_PROGRESS, PROGRESS_EVENT, PROGRESS_KEY, readProgress } from '@/lib/local-progress';
import type { ProgressFile } from '@/lib/local-progress';

/**
 * Subscribe to the signed-out progress file.
 *
 * `useSyncExternalStore` rather than useState + useEffect for two reasons. It gives a
 * server snapshot, so the mastery bar renders as "nothing yet" during SSR instead of
 * hydration-mismatching; and it means several bars on one page share one read rather than
 * each hitting localStorage on every render.
 *
 * The snapshot is cached because getSnapshot must return a referentially stable value -
 * parsing the JSON afresh on every call would hand React a new object each time and spin.
 */

let cache: ProgressFile | null = null;

function invalidate(): void {
  cache = null;
}

function getSnapshot(): ProgressFile {
  cache ??= readProgress();
  return cache;
}

function getServerSnapshot(): ProgressFile {
  return EMPTY_PROGRESS;
}

function subscribe(onChange: () => void): () => void {
  const handle = (): void => {
    invalidate();
    onChange();
  };
  // Our own writes, plus writes from another tab of the same site.
  window.addEventListener(PROGRESS_EVENT, handle);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === PROGRESS_KEY) handle();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, handle);
    window.removeEventListener('storage', onStorage);
  };
}

export function useProgress(): ProgressFile {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Exported for tests, which need to drop the cache between cases. */
export function resetProgressCache(): void {
  invalidate();
}
