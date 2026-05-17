import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'packages/shared/src/**/*.ts',
        'apps/worker/src/**/*.ts',
        'apps/dashboard/src/**/*.tsx',
        'apps/dashboard/src/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', '**/types.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@clawping/shared': `${repoRoot}packages/shared/src/index.ts`,
      'cloudflare:workers': `${repoRoot}test-shims/cloudflare-workers.ts`,
    },
  },
});
