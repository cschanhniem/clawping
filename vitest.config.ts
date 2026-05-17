import { defineConfig } from 'vitest/config';

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
      '@clawping/shared': '/Volumes/SSD/clawping/clawping/packages/shared/src/index.ts',
      'cloudflare:workers': '/Volumes/SSD/clawping/clawping/test-shims/cloudflare-workers.ts',
    },
  },
});
