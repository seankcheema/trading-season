import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_PORT, SERVICE_PORT, UI_PORT } from './e2e/fixtures/ports';

const SERVICE_DIR = join(__dirname, '..', 'reporting-service');

// E2E_REUSE_SERVERS leaves processes already listening on the suite's ports alone, to write a
// spec against a stack started by hand. They are not reseeded, so a spec can see data left by
// an earlier run.
const REUSE = !!process.env['E2E_REUSE_SERVERS'];

/**
 * The Python that runs the service. E2E_PYTHON wins; otherwise the service's
 * own virtual environment, as start-local.ps1 uses; otherwise whatever
 * `python` is on the PATH, which is what CI provides with the requirements
 * installed.
 */
function pythonCommand(): string {
  const configured = process.env['E2E_PYTHON'];
  if (configured) {
    return `"${configured}"`;
  }
  for (const candidate of [
    join(SERVICE_DIR, 'venv', 'Scripts', 'python.exe'),
    join(SERVICE_DIR, 'venv', 'bin', 'python'),
  ]) {
    if (existsSync(candidate)) {
      return `"${candidate}"`;
    }
  }
  return 'python';
}

/**
 * Integration configuration for the reporting platform.
 *
 * Three processes are started, on ports of their own so that a running dev
 * stack is not used by mistake:
 *
 * - the real Reporting Service, on a throwaway files directory filled from
 *   e2e/fixtures/scenario.json through the service's own event store and
 *   report run (e2e/support/run_reporting_service.py);
 * - a stand-in for the Auth Service that signs real RS256 tokens, whose JWKS
 *   the Reporting Service verifies them against (e2e/support/auth-standin.mjs);
 * - the production build of the Reporting UI, behind the same path split as
 *   nginx.conf (e2e/support/serve-ui.mjs).
 *
 * The browser therefore drives the real Angular application against the real
 * service's read model, report run and access rules. Kafka and the trading
 * database are the two things left out: the service reads neither, only the
 * files the consumer would have written from the topics.
 */
export default defineConfig({
  testDir: './e2e',
  // The suite only reads, and every spec signs in for itself.
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  failOnFlakyTests: !!process.env['CI'],
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright/html', open: 'never' }],
    ['junit', { outputFile: 'reports/playwright/junit.xml' }],
  ],
  outputDir: 'reports/playwright/artifacts',
  use: {
    baseURL: `http://127.0.0.1:${UI_PORT}`,
    // Days are the viewer's own, and the scenario is laid out in UTC days.
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/auth-standin.mjs',
      env: { PORT: String(AUTH_PORT) },
      url: `http://127.0.0.1:${AUTH_PORT}/health`,
      reuseExistingServer: REUSE,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `${pythonCommand()} e2e/support/run_reporting_service.py`,
      env: {
        PORT: String(SERVICE_PORT),
        AUTH_SERVICE_URL: `http://127.0.0.1:${AUTH_PORT}`,
        AUTH_JWT_ISSUER: `http://127.0.0.1:${AUTH_PORT}`,
      },
      url: `http://127.0.0.1:${SERVICE_PORT}/health`,
      reuseExistingServer: REUSE,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // E2E_SKIP_BUILD reuses the dist of the last build while a spec is being written.
      command: `${process.env['E2E_SKIP_BUILD'] ? '' : 'npm run build && '}node e2e/support/serve-ui.mjs`,
      env: {
        PORT: String(UI_PORT),
        REPORTING_URL: `http://127.0.0.1:${SERVICE_PORT}`,
        AUTH_URL: `http://127.0.0.1:${AUTH_PORT}`,
      },
      url: `http://127.0.0.1:${UI_PORT}`,
      reuseExistingServer: REUSE,
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
