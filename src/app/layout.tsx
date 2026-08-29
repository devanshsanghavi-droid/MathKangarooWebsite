import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { SITE } from '@/lib/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileTabBar } from '@/components/MobileTabBar';
import { SkipLink } from '@/components/SkipLink';
import { THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: 'Devansh Sanghavi' }],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
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
    <html lang={SITE.locale} suppressHydrationWarning>
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
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
        <MobileTabBar />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
