import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `pnpm dev` sets NEXT_DIST_DIR so the dev server and `pnpm build` do not share .next.
  // Without this, running a production build while the dev server is up deletes the chunks
  // the dev server is serving and every route 500s until it is restarted.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Types are checked by `pnpm typecheck` in CI; do not double-check during build.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Linting runs as its own CI step so a lint failure is reported separately from a build failure.
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
