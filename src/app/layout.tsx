import type { Metadata, Viewport } from 'next';
import { Figtree, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google';
import '@/styles/globals.css';
import { SITE } from '@/lib/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileTabBar } from '@/components/MobileTabBar';
import { SkipLink } from '@/components/SkipLink';
import { THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { ProgressSync } from '@/components/ProgressSync';
import { TelemetryProvider } from '@/components/telemetry/TelemetryProvider';

/*
 * docs/05-DESIGN-DIRECTION.md §5. Three faces: Figtree for headings and UI, Source Sans 3 for
 * reading, IBM Plex Mono for ids and point values.
 *
 * next/font downloads them at BUILD time and serves them from our own origin. That matters
 * more here than it usually does: the users are minors, CLAUDE.md forbids third-party
 * requests, and a plain <link> to fonts.googleapis.com would hand a font CDN an IP address
 * and a referer on every page load. Nothing leaves the student's browser.
 *
 * Each exposes a CSS variable that tokens.css composes into --ui / --body / --mono along with
 * a full system fallback stack, so a page still sets correctly if a face fails to load.
 */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} - ${SITE.tagline}`,
    template: `%s - ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: 'Devansh Sanghavi' }],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
    url: SITE.url,
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  // The users are minors and the analytics are cookie-free; there is nothing to verify with
  // a third-party tracker, so no verification tags are declared here.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // No `maximumScale`: capping zoom would break the 200% requirement in CLAUDE.md.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={SITE.locale}
      suppressHydrationWarning
      className={`${figtree.variable} ${sourceSans.variable} ${plexMono.variable}`}
    >
      <head>
        {/*
          Runs before first paint so a dark-theme reader never sees a white flash. Kept inline
          and tiny on purpose; see THEME_INIT_SCRIPT in components/ThemeToggle.tsx.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        <Header />
        {/*
          The skill rail is not here: only /atlas and /skill draw it, so their own layouts
          add it (components/shell/RailLayout.tsx). Keeping it out of the root layout keeps
          the content index off every request-time path (docs/06 §3).
        */}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
        <MobileTabBar />
        <ServiceWorkerRegistration />
        <ProgressSync />
        <TelemetryProvider />
      </body>
    </html>
  );
}
