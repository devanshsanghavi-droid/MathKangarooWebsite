import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { themeColor } from '@/lib/theme-colors';

/**
 * The web manifest. The service worker and install prompt are P2; this exists now so the app
 * has a name, a colour, and an icon the moment it is added to a home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: 'Kangaroo',
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    // A manifest is JSON read by the operating system, so it needs literal colours rather than
    // custom properties. They are read out of tokens.css at build time so tokens.css stays the
    // only place a colour is defined. See src/lib/theme-colors.ts.
    background_color: themeColor('--paper'),
    theme_color: themeColor('--accent'),
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
