//
// Kangaroo Atlas service worker.
//
// Hand-written rather than generated, because it is 120 lines and because a student on a bad
// connection deserves a caching strategy someone actually thought about.
//
// The strategies, and why each one:
//
//   navigations  network-first, then cache, then the offline page. The site is content that
//                changes when problems are added, so a stale page is worse than a slow one -
//                but a stale page is much better than nothing on a train.
//   /_next/static  cache-first. Those filenames contain a content hash, so a cached one is by
//                definition still correct and can never go stale.
//   everything else  passed straight through. In particular anything that is not a GET, and
//                anything under /api/, is never touched: caching a write would be a bug with
//                real consequences.
//
// The cache name carries a version. Bumping it is how an old cache is thrown away.

const VERSION = 'v1';
const SHELL_CACHE = `ka-shell-${VERSION}`;
const PAGE_CACHE = `ka-pages-${VERSION}`;
const STATIC_CACHE = `ka-static-${VERSION}`;

// The pages worth having before they are ever asked for. Kept short on purpose: a student on a
// metered connection should not pay for the whole site on first visit.
const SHELL_URLS = ['/', '/atlas', '/problems', '/offline'];

// How many problem and skill pages to keep. Enough for a week of practice, small enough that
// the cache never becomes a reason the phone runs out of room.
const MAX_PAGES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      // A shell page that 404s during a deploy must not stop the worker installing.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('ka-') && !name.endsWith(VERSION))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Keep a cache from growing without limit, oldest entry first. */
async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
      await trim(PAGE_CACHE, MAX_PAGES);
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match('/offline'));
    return (
      cached ||
      new Response('You are offline and this page has not been visited before.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch a write, and never touch the API. A cached POST is a bug with consequences.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStatic(request));
  }
});

// Lets the page ask the worker to take over immediately after an update, rather than waiting
// for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
