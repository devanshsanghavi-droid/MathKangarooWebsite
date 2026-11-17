'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProgress } from '@/components/mastery/useProgress';

/**
 * Registers the service worker, and offers the install prompt when the browser fires one.
 *
 * Two deliberate limits:
 *
 *  - **Production only.** A service worker in development caches the dev server's chunks and
 *    then serves them after a rebuild, which produces a broken page and an hour of confusion.
 *  - **No nagging.** The install button appears only if the browser itself decides the site is
 *    installable, it is dismissible, and the dismissal is remembered. An install prompt that
 *    reappears on every visit is an advertisement.
 *  - **Not on a first look.** It waits until the student has tried a few problems, so a new
 *    visitor's first screen is the site, not a pop-up.
 */

const DISMISSED_KEY = 'ka-install-dismissed';

/** Distinct problems tried in this browser before the install prompt may appear. */
const MIN_PROBLEMS_TRIED = 3;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function ServiceWorkerRegistration() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const progress = useProgress();
  const tried = useMemo(() => {
    const ids = new Set<string>();
    for (const attempts of Object.values(progress.attempts)) {
      for (const attempt of attempts) ids.add(attempt.problemId);
    }
    return ids.size;
  }, [progress]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    // Registration failing is not worth telling a student about: the site works without it.
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Storage disabled. Showing the prompt once is a reasonable default.
    }
    if (dismissed) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setInstallEvent(null);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Not being able to remember the dismissal is not a reason to refuse it.
    }
  }

  async function install() {
    const event = installEvent;
    if (!event) return;
    setInstallEvent(null);
    await event.prompt();
    await event.userChoice;
  }

  if (!installEvent || tried < MIN_PROBLEMS_TRIED) return null;

  return (
    <div
      role="region"
      aria-label="Install this site"
      className="no-print fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-md border border-rule bg-surface p-3 shadow-lg sm:bottom-3"
    >
      <p className="m-0 text-sm text-ink">
        Add Kangaroo Atlas to your home screen? It then opens instantly and keeps working on a bad
        connection.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={install}
          className="cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-3 py-1.5 text-sm font-medium text-ink"
        >
          Add it
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="cursor-pointer rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
