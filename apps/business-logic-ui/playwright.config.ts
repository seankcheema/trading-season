import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration for the login and registration journeys.
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
  // Every spec creates its own accounts, so nothing is shared between workers.
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
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
  webServer: {
    // Deliberately the built SSR server rather than `ng serve`. The Vite dev
    // server dies part way through a parallel run on Windows, taking the
    // remaining tests down with a connection error, and a production build is
    // the closer match to what these journeys run against anyway. /api needs no
    // proxy here because every API call is answered by the stub.
    command: 'npm run build && node dist/business-logic-ui/server/server.mjs',
    // NG_ALLOWED_HOSTS supplies the host allowlist at runtime. The build's
    // security.allowedHosts is empty on purpose, and a deployment is expected
    // to name its own hosts; this names the one the suite serves on rather
    // than relaxing that setting.
    env: { PORT: '4200', NG_ALLOWED_HOSTS: 'localhost' },
    url: 'http://localhost:4200',
    // Locally, reuse a server that is already up; CI always builds its own.
    reuseExistingServer: !process.env['CI'],
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
