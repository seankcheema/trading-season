import { defineConfig } from 'vitest/config';

// Same setting as apps/client-ui/vitest.config.ts, for the same reason: Jenkins
// runs this suite in a `parallel` block with the other test stages on one agent,
// and under that CPU contention Vitest's default forked worker pool
// intermittently fails to start within its handshake timeout, which aborts the
// run with zero tests collected. A single fork avoids it. The Angular CLI loads
// this file only because `runnerConfig: true` is set in angular.json.
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
