import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // JUnit XML so Jenkins can publish results and, more importantly, fail the
    // build when the file is missing. Without a report there is no way for CI
    // to tell "all tests passed" from "no tests ran".
    reporters: process.env.CI
      ? ['default', ['junit', { outputFile: 'reports/junit/vitest.xml' }]]
      : ['default'],
    coverage: {
      provider: 'v8',
      // cobertura and lcov are for CI to publish; text keeps the summary in the log.
      reporter: ['text', 'html', 'lcovonly', 'cobertura'],
      // A floor rather than a target: below this the run fails, so "coverage is
      // at least 50%" is enforced by the build instead of read off a report.
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
