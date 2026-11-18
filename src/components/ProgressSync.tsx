'use client';

import { useEffect } from 'react';
import { PROGRESS_EVENT, parseProgress, readProgress, writeProgress } from '@/lib/local-progress';
import { readSignedInHint } from '@/lib/signed-in-hint';

/** Wait this long after the last saved attempt before uploading, so a set sends once. */
const DEBOUNCE_MS = 4000;

/**
 * Keeps this browser's progress and the signed-in account's copy in step. Renders nothing.
 *
 * Does nothing at all unless the sign-in hint cookie is present, so a student who never signs
 * in sends no request. When signed in: one upload on page load (the server merges it with what
 * it holds and returns the union, which is written back here), then one upload a few seconds
 * after each new attempt. Merging is a union on both sides, so no device can erase another's
 * work. Failures are silent: progress is always safe in this browser first.
 */
export function ProgressSync() {
  useEffect(() => {
    if (!readSignedInHint()) return;
    let lastSynced = '';
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const push = async (keepalive = false): Promise<void> => {
      if (stopped) return;
      const body = JSON.stringify(readProgress());
      if (body === lastSynced) return;
      try {
        const response = await fetch('/api/progress', {
          method: 'PUT',
          body,
          keepalive,
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
        });
        if (response.status === 401) {
          stopped = true;
          return;
        }
        if (!response.ok) return;
        const merged = parseProgress(await response.text());
        lastSynced = JSON.stringify(merged);
        if (lastSynced !== body) writeProgress(merged);
      } catch {
        // Offline or blocked: the next attempt or page load tries again.
      }
    };

    const schedule = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => void push(), DEBOUNCE_MS);
    };
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') void push(true);
    };

    void push();
    window.addEventListener(PROGRESS_EVENT, schedule);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener(PROGRESS_EVENT, schedule);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  return null;
}
