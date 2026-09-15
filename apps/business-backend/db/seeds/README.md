# Database seed datasets

Do not commit generated archives. `synthetic-market-data-2026-v1/` remains ignored and contains the single consolidated dataset identity.

A full archive has `manifest.json`, 261 compressed daily tick partitions, 261 compressed daily candle partitions, 61,074,000 ticks, and 1,017,900 candles for the ten configured symbols. Every weekday is included, including holidays; sessions run from 08:30:00 through 14:59:59 America/Chicago.

Follow the [numbered script workflow](../scripts/README.md). An existing candle-only archive is recognized but cannot be reused: pass `--regenerate` to replace ticks and matching candles atomically. Date ranges are intended for tests and benchmarks.
