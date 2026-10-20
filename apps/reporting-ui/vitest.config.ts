import { defineConfig } from 'vitest/config';

// Jenkins runs this suite in a `parallel` block with other stages on one agent.
// Limit CPU contention during worker startup and test execution by running
// test files in one worker. The Angular CLI loads
// this file through the explicit `runnerConfig` path in angular.json.
export default defineConfig({
  test: {
    pool: 'forks',
    // Vitest 4 replaced poolOptions.forks.singleFork with maxWorkers.
    maxWorkers: 1,
    fileParallelism: false,
    // The shared Jenkins agent can stall a render for far longer than the
    // 5 s default (the activity chart tests took 26 s and 64 s there).
    testTimeout: 120_000,
  },
});
