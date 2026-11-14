import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * Crawlers that collect text to train AI models. They bring no visitors, and on the Workers
 * free plan every page they fetch spends the same daily request allowance a student needs.
 * The bank is CC BY-NC-SA, non-commercial, which a commercial training crawl does not honour.
 * Search engines (Googlebot, Bingbot) are untouched; Google-Extended only governs AI training.
 * robots.txt is voluntary: crawlers that ignore it have to be stopped at Cloudflare instead.
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'Amazonbot',
  'cohere-ai',
  'Diffbot',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/*?` closes every query-string URL. The filters on /problems, /atlas and /print
        // combine into hundreds of thousands of URLs, each rendered by the worker; the sitemap
        // already lists every real page, so nothing indexable is lost.
        disallow: ['/api/', '/*?'],
      },
      { userAgent: [...AI_TRAINING_CRAWLERS], disallow: '/' },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
