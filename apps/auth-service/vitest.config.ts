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
  },
});
