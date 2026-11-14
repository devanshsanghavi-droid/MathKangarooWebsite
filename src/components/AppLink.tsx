import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * next/link with prefetching OFF by default. Every internal link imports this, not next/link.
 *
 * Next prefetches each link the moment it scrolls into view, and on Cloudflare Workers every
 * prefetch is a billed request to the worker. Measured on a production build, one view of the
 * home page made 18 worker requests: the page itself plus 17 prefetches nobody asked for. On
 * the free plan's 100,000 requests a day that turns a few thousand real visitors into an
 * outage (Error 1027). Pages here are small and mostly prerendered, so loading on click costs
 * a student very little. Pass `prefetch` explicitly on the rare link that should keep it.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
