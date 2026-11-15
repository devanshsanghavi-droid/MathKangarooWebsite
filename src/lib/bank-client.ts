import {
  dataPaths,
  type AmcIndexFile,
  type AmcLookups,
  type KaIndexFile,
  type KaLookups,
} from './bank-data';
import type { PracticeItem } from './practice-item';

/**
 * Browser-side readers for `public/data/` (see bank-data.ts for the formats).
 *
 * One in-flight promise per URL, shared by every caller, so a bank page and a practice set on
 * the same visit fetch each file once. A failed fetch is NOT cached: the next caller tries
 * again, which is what a student on a flaky school connection needs.
 */

const cache = new Map<string, Promise<unknown>>();

export class StaticDataError extends Error {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number) {
    super(`could not load ${url} (${status || 'network error'})`);
    this.name = 'StaticDataError';
    this.url = url;
    this.status = status;
  }
}

export function fetchStaticJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const promise = fetch(url, { headers: { accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new StaticDataError(url, response.status);
      return (await response.json()) as T;
    })
    .catch((error: unknown) => {
      cache.delete(url);
      throw error instanceof StaticDataError ? error : new StaticDataError(url, 0);
    });
  cache.set(url, promise);
  return promise;
}

export const loadKaIndex = (): Promise<KaIndexFile> => fetchStaticJson(dataPaths.kaIndex);
export const loadKaLookups = (): Promise<KaLookups> => fetchStaticJson(dataPaths.kaLookups);
export const loadAmcIndex = (): Promise<AmcIndexFile> => fetchStaticJson(dataPaths.amcIndex);
export const loadAmcLookups = (): Promise<AmcLookups> => fetchStaticJson(dataPaths.amcLookups);
export const loadPracticeItem = (id: string): Promise<PracticeItem> =>
  fetchStaticJson(dataPaths.problem(id));

/**
 * Every item of a set, in the order asked for. An id whose file is missing (a problem retired
 * since the link was shared) is dropped and reported rather than failing the whole set.
 */
export async function loadPracticeItems(
  ids: readonly string[],
): Promise<{ items: PracticeItem[]; missing: string[] }> {
  const settled = await Promise.allSettled(ids.map((id) => loadPracticeItem(id)));
  const items: PracticeItem[] = [];
  const missing: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') items.push(result.value);
    else missing.push(ids[index] ?? '');
  });
  return { items, missing };
}

/** Exported for tests. */
export function resetStaticDataCache(): void {
  cache.clear();
}
