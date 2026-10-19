import { defineConfig } from 'vitest/config';

// Jenkins runs this suite alongside four other heavy stages (two Maven
// test runs, the auth-service Vitest run, and the Synthetic Market Data
// Docker build) in the same `parallel` block, all on one agent. Under that
// CPU contention, Vitest's default forked worker pool intermittently fails
// to start within its handshake timeout ("Timeout waiting for worker to
// respond"), which aborts the whole run with zero tests collected. A single
// fork avoids racing other processes for CPU to spin up workers, and the
// Angular CLI loads this file through the explicit `runnerConfig` path in
// angular.json.
//
// The same contention stretches individual tests. The dashboard suite runs in
// about 5 seconds on an idle machine but 58 seconds on the agent, and one
// synchronous test (a tab toggle) stalled for 23 seconds and failed Vitest's
// default 5 second limit although it passed on every other run. Nothing in it
// waits on a timer or the network, so the limit is raised to absorb CPU
// starvation instead of the test being changed.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
  },
});
