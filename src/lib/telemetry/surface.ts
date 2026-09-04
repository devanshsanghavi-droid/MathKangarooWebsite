import type { Surface } from './events';

/**
 * Map a pathname onto the closed set of surface names.
 *
 * The mapping exists so that a RAW PATHNAME never reaches the collector. A pathname can carry
 * a query string, a query string can carry whatever a student typed into a filter, and the one
 * rule this system has is that nothing free-text is ever recorded. Turning the URL into an
 * enum at the boundary makes that structural rather than a habit.
 *
 * An unrecognised path is 'not-found' rather than a passthrough, for the same reason.
 */
export function surfaceFor(pathname: string): Surface {
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') ?? '';
  if (path === '' || path === '/') return 'home';
  if (/^\/skill\/[A-Z]{3}-\d{2}\/learn$/.test(path)) return 'skill-learn';
  if (/^\/skill\/[A-Z]{3}-\d{2}\/practice\/[345]$/.test(path)) return 'skill-ladder';
  if (/^\/skill\/[A-Z]{3}-\d{2}\/quiz$/.test(path)) return 'skill-quiz';
  if (/^\/skill\/[A-Z]{3}-\d{2}$/.test(path)) return 'skill-unit';
  if (/^\/atlas\/[A-Z]{3}$/.test(path)) return 'atlas-strand';
  if (path === '/atlas') return 'atlas';
  if (/^\/problem\/KA-\d{4}$/.test(path)) return 'problem';
  if (path === '/problems') return 'problems';
  if (/^\/papers\/.+/.test(path)) return 'paper';
  if (path === '/papers') return 'papers';
  if (path === '/practice/diagnostic') return 'diagnostic';
  if (path === '/practice/mock') return 'mock';
  if (path === '/print') return 'worksheet';
  if (path === '/about') return 'about';
  if (path.startsWith('/legal')) return 'legal';
  if (path === '/contact') return 'contact';
  if (path === '/offline') return 'offline';
  return 'not-found';
}

/** The skill id in a path, when there is one. Enumerated by construction: it matched a regex. */
export function skillIdFor(pathname: string): string | undefined {
  return /^\/skill\/([A-Z]{3}-\d{2})(?:\/|$)/.exec(pathname)?.[1];
}

export function problemIdFor(pathname: string): string | undefined {
  return /^\/problem\/(KA-\d{4})$/.exec(pathname)?.[1];
}
