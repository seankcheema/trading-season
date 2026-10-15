import { defineConfig } from 'vitest/config';

// Jenkins runs this suite in a `parallel` block with other stages on one agent.
// Limit CPU contention during worker startup and test execution by running
// test files in one worker. The Angular CLI loads
// this file only because `runnerConfig: true` is set in angular.json.
export default defineConfig({
  test: {
    pool: 'forks',
    // Vitest 4 replaced poolOptions.forks.singleFork with maxWorkers.
    maxWorkers: 1,
    fileParallelism: false,
  },
});
