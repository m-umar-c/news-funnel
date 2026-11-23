import { defineConfig } from 'vitest/config';

const dbUrl = process.env.TEST_DATABASE_URL ?? 'postgres://funnel:funnel@localhost:5432/funnel_test';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      DATABASE_URL: dbUrl,
      NODE_ENV: 'test',
      EMBEDDING_PROVIDER: 'hash',
      SUMMARY_PROVIDER: 'extractive',
      JWT_SECRET: 'test-secret-value',
      CLUSTER_THRESHOLD: '0.5',
    },
  },
});
