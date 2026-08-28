import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm a11y` — axe-core against rendered routes and components, in both themes.
 * Split from the unit suite because it is slower and because a11y regressions deserve
 * their own signal rather than being buried in a 300-test run.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // See test/stubs/server-only.ts for why this alias exists.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.a11y.test.tsx'],
    passWithNoTests: true,
    testTimeout: 20_000,
    css: false,
  },
});
