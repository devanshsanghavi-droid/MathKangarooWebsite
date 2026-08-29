import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A service worker is the one piece of code that can break a site for a returning visitor in a
 * way a redeploy does not fix. These are the invariants worth pinning down in source, since
 * the behaviour itself needs a browser.
 */
const sw = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

describe('the service worker', () => {
  it('never handles a request that is not a GET', () => {
    // Caching or replaying a write would be a bug with real consequences.
    expect(sw).toMatch(/request\.method !== 'GET'/);
  });

  it('never touches the API', () => {
    expect(sw).toMatch(/pathname\.startsWith\('\/api\/'\)/);
  });

  it('ignores cross-origin requests', () => {
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });

  it('is network-first for navigations, so a new problem is not hidden by a stale page', () => {
    const navigation = sw.slice(sw.indexOf('async function handleNavigation'));
    expect(navigation.indexOf('await fetch(request)')).toBeLessThan(
      navigation.indexOf('caches.match(request)'),
    );
  });

  it('falls back to the offline page when nothing is cached', () => {
    expect(sw).toMatch(/caches\.match\('\/offline'\)/);
  });

  it('is cache-first only for content-hashed static assets', () => {
    expect(sw).toMatch(/pathname\.startsWith\('\/_next\/static\/'\)/);
    const staticHandler = sw.slice(sw.indexOf('async function handleStatic'));
    expect(staticHandler.indexOf('caches.match(request)')).toBeLessThan(
      staticHandler.indexOf('await fetch(request)'),
    );
  });

  it('caps the page cache so it cannot fill a phone', () => {
    expect(sw).toMatch(/MAX_PAGES\s*=\s*\d+/);
    expect(sw).toMatch(/trim\(PAGE_CACHE, MAX_PAGES\)/);
  });

  it('deletes its own old caches on activate', () => {
    expect(sw).toMatch(/name\.startsWith\('ka-'\) && !name\.endsWith\(VERSION\)/);
  });

  it('carries a version that can be bumped to invalidate everything', () => {
    expect(sw).toMatch(/const VERSION = '[^']+'/);
  });

  it('precaches a short shell rather than the whole site', () => {
    const urls = /SHELL_URLS = \[([^\]]*)\]/.exec(sw)?.[1] ?? '';
    const count = urls.split(',').filter((entry) => entry.trim()).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
    expect(urls).toContain("'/offline'");
  });

  it('survives a shell page 404ing during a deploy', () => {
    expect(sw).toMatch(/\.catch\(\(\) => undefined\)/);
  });
});

describe('the offline page it falls back to', () => {
  const page = readFileSync(join(process.cwd(), 'src', 'app', 'offline', 'page.tsx'), 'utf8');

  it('exists and is not indexed', () => {
    expect(page).toMatch(/robots: \{ index: false/);
  });

  it('says which pages still work, rather than only apologising', () => {
    expect(page).toMatch(/\/atlas/);
    expect(page).toMatch(/\/problems/);
  });
});
