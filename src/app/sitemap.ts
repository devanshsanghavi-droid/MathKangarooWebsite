import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { contentIndex, paperKey } from '@/lib/content';
import { STRANDS } from '@/lib/schemas';

/**
 * The sitemap is generated from content, not hand-listed: adding a skill file adds its page
 * here with no second edit. Priorities encode what the site is for — the Atlas and the skill
 * pages are the point, the legal pages are not.
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
  const index = contentIndex();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE.url}${route.path}`,
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));

  for (const strand of STRANDS) {
    entries.push({
      url: `${SITE.url}/atlas/${strand}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  for (const skill of index.skills) {
    entries.push({
      url: `${SITE.url}/skill/${skill.id}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
    /*
     * The unit page is mostly navigation now (docs/05 §7.2); /learn is where the definition,
     * the recognition cues, the worked example and the misconceptions actually live, so it is
     * listed in its own right.
     *
     * The three ladders and the quiz are deliberately NOT listed. They are tools rather than
     * documents — 364 pages whose prose is "practise X at tier N" — and they are reachable
     * from the unit page anyway. Listing them would be thin content by the cartload.
     */
    entries.push({
      url: `${SITE.url}/skill/${skill.id}/learn`,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  for (const problem of index.problems) {
    entries.push({
      url: `${SITE.url}/problem/${problem.id}`,
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: new Date(problem.createdAt),
    });
  }

  for (const paper of index.papers) {
    entries.push({
      url: `${SITE.url}/papers/${paperKey(paper.year, paper.band)}`,
      changeFrequency: 'yearly',
      priority: 0.4,
    });
  }

  return entries;
}
