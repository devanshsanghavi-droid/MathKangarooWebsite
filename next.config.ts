import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
