import { defineConfig, devices } from '@playwright/test';

/**
 * UI integration configuration for authentication, account, and trading journeys.
 *
 * The suite drives the real Angular application — router, guards, reactive
 * forms, HTTP interceptor and browser storage — against a contract-accurate
 * stand-in for the NestJS auth service and the Java business backend
 * (see e2e/fixtures/api-stub.ts). Stubbing at the network boundary is what
 * makes the request transcript observable, which the sensitive-data checks
 * depend on, and it keeps the suite runnable without Docker or Postgres.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './scripts/playwright-setup.mjs',
  // Every spec creates its own accounts, so nothing is shared between workers.
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  failOnFlakyTests: !!process.env['CI'],
  // A conservative, explicit worker count rather than CI's single-core
  // default or local auto-detection: enough to parallelize the spec
  // files without assuming the Jenkins agent has local-machine-level cores.
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright/html', open: 'never' }],
    ['junit', { outputFile: 'reports/playwright/junit.xml' }],
  ],
  outputDir: 'reports/playwright/artifacts',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
