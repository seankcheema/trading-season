import { defineConfig } from 'vitest/config';

// Jenkins runs this suite alongside four other heavy stages (two Maven
// test runs, the auth-service Vitest run, and the Synthetic Market Data
// Docker build) in the same `parallel` block, all on one agent. Under that
// CPU contention, Vitest's default forked worker pool intermittently fails
// to start within its handshake timeout ("Timeout waiting for worker to
// respond"), which aborts the whole run with zero tests collected. A single
// fork avoids racing other processes for CPU to spin up workers, and the
// Angular CLI loads this file only because `runnerConfig: true` is set in
// angular.json.
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
