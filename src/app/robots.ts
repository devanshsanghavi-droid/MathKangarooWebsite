import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is secret, but there is no reason to index an error state.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
