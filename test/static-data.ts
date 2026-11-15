import { vi } from 'vitest';
import { getAllProblems, getAllSkills, getProblem, getSkill } from '@/lib/content';
import { buildKaIndex, buildKaLookups, DATA_BASE, dataPaths } from '@/lib/bank-data';
import { kaPracticeItem } from '@/lib/practice-item';
import { resetStaticDataCache } from '@/lib/bank-client';

/**
 * Serves `public/data/` to client components under test without a build: a `fetch` stub that
 * answers each static-data URL with the same builders scripts/build-static-data.ts runs, over
 * the same Kangaroo content the server components read. Install it in a test, and call
 * `vi.unstubAllGlobals()` afterwards.
 *
 * `extra` adds or overrides files by path, e.g. an AMC item for a practice set.
 */
export function installStaticDataFetch(extra: Record<string, unknown> = {}) {
  resetStaticDataCache();
  const problems = getAllProblems();
  let index: unknown;
  let lookups: unknown;
  const resolve = (path: string): unknown => {
    if (path in extra) return extra[path];
    if (path === dataPaths.kaIndex) return (index ??= buildKaIndex(problems));
    if (path === dataPaths.kaLookups) return (lookups ??= buildKaLookups(getAllSkills(), problems));
    const match = new RegExp(`^${DATA_BASE}/p/(KA-\\d{4})\\.json$`).exec(path);
    const problem = match?.[1] ? getProblem(match[1]) : undefined;
    if (problem) return kaPracticeItem(problem, (id) => getSkill(id)?.name);
    return undefined;
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, 'http://localhost').pathname;
    const body = resolve(path);
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
