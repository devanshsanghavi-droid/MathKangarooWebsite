import { SITE } from '@/lib/site';

/**
 * JSON-LD for the home page.
 *
 * This exists to answer a specific failure: searching the project's own name returned the
 * Terms page rather than the home page. With no structured data, a crawler sees several thin
 * pages that all carry the brand name in their title and has nothing telling it which URL IS
 * the site. WebSite plus EducationalOrganization, both anchored to the root, say so directly.
 *
 * The legal pages are separately marked noindex, so they stop competing for the brand query
 * at all. Nothing of value is lost: they are boilerplate with no search intent behind them.
 */
export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: 'en',
        publisher: { '@id': `${SITE.url}/#org` },
      },
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE.url}/#org`,
        name: SITE.name,
        url: SITE.url,
        description:
          'A free, open platform for Math Kangaroo preparation, organised by skill rather ' +
          'than by past paper. Independent, not affiliated with Math Kangaroo in USA, NFP.',
        sameAs: [SITE.repo],
        isAccessibleForFree: true,
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE.url}/#home`,
        url: SITE.url,
        name: `${SITE.name} - ${SITE.tagline}`,
        isPartOf: { '@id': `${SITE.url}/#website` },
        about: { '@id': `${SITE.url}/#org` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The payload is built from SITE constants, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
