import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * Static routes. Content-derived entries - one per skill, problem, strand and paper - are
 * appended in `contentSitemapEntries()` once the content layer exists (M1.2).
 */
export const STATIC_ROUTES = [
  { path: '/', priority: 1 },
  { path: '/atlas', priority: 0.9 },
  { path: '/problems', priority: 0.8 },
  { path: '/papers', priority: 0.7 },
  { path: '/about', priority: 0.5 },
  { path: '/contact', priority: 0.3 },
  { path: '/legal/privacy', priority: 0.3 },
  { path: '/legal/terms', priority: 0.3 },
  { path: '/legal/license', priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map((route) => ({
    url: `${SITE.url}${route.path}`,
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));
}
