import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * `node scripts/publish-static-pages.ts` - runs after `opennextjs-cloudflare build`.
 *
 * Copies every prerendered page from .next/server/app into .open-next/assets so Cloudflare
 * serves it as a static asset, without invoking the Worker.
 *
 * ---------------------------------------------------------------------------------------
 * WHY
 *
 * On the Workers free plan every request that reaches the Worker counts against a 100,000 a
 * day limit; past it, every page returns Error 1027 until 00:00 UTC. Static asset requests
 * are free and unlimited, and they are served even while the Worker is rate limited.
 *
 * OpenNext keeps prerendered HTML in its incremental cache and serves it THROUGH the Worker,
 * so a fully static site still spent one Worker request per page view. Scrapers spent the
 * whole day's allowance in four hours on 2026-11-15.
 *
 * With the HTML in the assets directory, Cloudflare matches `/about` to `about.html` (the
 * default `auto-trailing-slash` html_handling) and never wakes the Worker. Only requests with
 * no matching file reach it: /login, /admin, /api/events, OG images and unknown URLs.
 *
 * Client-side navigation still works. The Next router asks for `/about?_rsc=...`; the asset
 * layer ignores the query and answers with HTML, the router sees a non-RSC content type, and
 * falls back to a normal full page load (fetch-server-response.ts, doMpaNavigation). Both
 * requests are static assets.
 *
 * Nothing is lost by skipping the Worker on these paths: middleware only matches /admin, and
 * next.config.ts sets no custom headers.
 * ---------------------------------------------------------------------------------------
 */

const ROOT = process.cwd();
const APP = join(ROOT, '.next', 'server', 'app');
const ASSETS = join(ROOT, '.open-next', 'assets');

/** Route files Next writes as `<name>.body` whose name already carries a usable extension. */
const BODY_FILES = new Set(['robots.txt.body', 'sitemap.xml.body', 'manifest.webmanifest.body']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!existsSync(APP) || !existsSync(ASSETS)) {
  console.error('publish-static-pages: run after `opennextjs-cloudflare build`.');
  process.exit(1);
}

let pages = 0;
let bodies = 0;
for (const file of walk(APP)) {
  const rel = relative(APP, file);
  let target: string | null = null;

  if (rel.endsWith('.html')) {
    // The not-found page must keep its 404 status, which only the Worker can send.
    if (rel === '_not-found.html' || rel.startsWith('_')) continue;
    target = rel;
    pages += 1;
  } else if (BODY_FILES.has(rel)) {
    target = rel.slice(0, -'.body'.length);
    bodies += 1;
  }

  if (!target) continue;
  const dest = join(ASSETS, target);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}

if (pages === 0) {
  console.error('publish-static-pages: no prerendered pages found in .next/server/app.');
  process.exit(1);
}
console.log(`publish-static-pages: ${pages} pages and ${bodies} route files copied to assets`);
