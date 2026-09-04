'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { flush, isOptedOut, returningBucket, track } from '@/lib/telemetry/client';
import { problemIdFor, skillIdFor, surfaceFor } from '@/lib/telemetry/surface';

/**
 * Mounts once in the root layout and records navigation.
 *
 * The first surface of a session is recorded separately as `entry`, because "what do people
 * seek out first" is a different question from "what gets viewed", and answering it from view
 * counts alone would just re-rank the popular pages.
 *
 * Buffered events are flushed when the tab is hidden rather than on an interval: `pagehide`
 * and `visibilitychange` are the only moments a browser reliably still runs script on a page
 * that is about to go away, and `sendBeacon` is built for exactly that.
 */
export function TelemetryProvider() {
  const pathname = usePathname() ?? '/';
  const isFirst = useRef(true);

  useEffect(() => {
    if (isOptedOut()) return;
    const surface = surfaceFor(pathname);
    const props = {
      surface,
      ...(skillIdFor(pathname) ? { skillId: skillIdFor(pathname) } : {}),
      ...(problemIdFor(pathname) ? { problemId: problemIdFor(pathname) } : {}),
    };

    if (isFirst.current) {
      isFirst.current = false;
      track('entry', { ...props, returning: returningBucket() });
    }
    track('surface_view', props);
  }, [pathname]);

  useEffect(() => {
    if (isOptedOut()) return;
    const send = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', send);
    window.addEventListener('pagehide', () => flush());
    return () => {
      document.removeEventListener('visibilitychange', send);
      flush();
    };
  }, []);

  return null;
}
