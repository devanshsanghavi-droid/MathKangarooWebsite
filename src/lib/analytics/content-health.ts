import 'server-only';
import health from './content-health.json';
import type { ContentHealth } from './content-health-core';

export type { ContentHealth } from './content-health-core';

/**
 * The bank's make-up for the admin panel, computed from content/ by
 * scripts/bundle-content.ts (see content-health-core.ts) and committed beside this file.
 * `pnpm check:bundle` fails when it drifts from content/, exactly like content.bundle.json.
 *
 * /admin renders per request, so this is deliberately a small precomputed file and not a walk
 * over the content index: the index would pull the whole content bundle into the worker.
 */
export function contentHealth(): ContentHealth {
  return health as ContentHealth;
}
