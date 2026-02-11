import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/ruleflow-web/e2e',
  testMatch: ['**/*.spec.ts', '**/*.e2e.ts'],
  timeout: 120_000,
  workers: process.env.CI ? 1 : undefined,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter ruleflow-web build && pnpm --filter ruleflow-web start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
