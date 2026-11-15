import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * OpenNext adapter config - how this Next.js app becomes a Cloudflare Worker.
 *
 * The site cannot be a static export, which is worth writing down because it looks like it
 * could be: since v3 (docs/06 §3) every page route is prerendered and the bank filters run in
 * the browser over public/data/. What still needs a server at request time:
 *
 *   /login, /admin              server actions and a session check.
 *   /api/events                 the telemetry collector is a POST handler.
 *   middleware                  guards /admin.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THE INCREMENTAL CACHE IS SET, AND WHAT HAPPENS WITHOUT IT
 *
 * With no `incrementalCache`, the worker has nowhere to read prerendered HTML from. Every
 * route built by `generateStaticParams` - all 874 of them - then misses, and because those
 * routes also set `dynamicParams = false`, a miss is not re-rendered on demand: it is a 404.
 * The site came up with a working home page, a working Atlas and a 404 on every skill,
 * problem, ladder and quiz. It looked like a routing bug and was a cache configuration.
 *
 * `staticAssetsIncrementalCache` reads that HTML back out of the Workers assets binding,
 * which is exactly right here and free: the content is fixed at build time, git is the CMS,
 * and revalidation never fires. The R2 and KV adapters exist for sites that rebuild pages at
 * runtime; this one does not, and they would cost money to do nothing.
 * ---------------------------------------------------------------------------------------
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
