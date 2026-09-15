# Synthetic market-data scripts

Run these cross-platform Python entrypoints from the repository root, in numeric order. Install `requirements.txt` first. The archive defaults to `apps/business-backend/db/seeds/synthetic-market-data-2026-v1`.

For the normal end-to-end workflow on Windows, use the single PowerShell entrypoint. It creates the virtual environment when needed, installs dependencies, generates or reuses the archive, carries the completed validation forward to the importer, and displays progress bars:

```powershell
apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season
```

Add `-InitializeDisposableDatabase` only for a first-time disposable setup; it runs the destructive V001 bootstrap. `-Regenerate`, `-Replace`, `-StartDate`, and `-EndDate` map to the corresponding workflow options.

1. `0001-initialize-database.py --database-url URL --disposable-database` applies V001 then V002. This is destructive first-time setup only. Never use it for ordinary seeding.
2. `0002-generate-synthetic-market-data.py [--start-date YYYY-MM-DD --end-date YYYY-MM-DD]` creates ticks and derived candles without database access. An old candle-only or different archive requires `--regenerate`; replacement is validated in staging before publication.
3. `0003-validate-synthetic-market-data.py` verifies checksums, exact one-second coverage, sequence uniqueness, spreads, and candle agreement without database access.
4. `0004-import-synthetic-market-data.py --database-url URL [--replace]` validates again and imports with bounded PostgreSQL COPY batches in one transaction. The importer avoids unnecessary global sorts and reports each loaded partition plus the final indexed inserts. An identical completed import is skipped; changed or candle-only session data requires `--replace`.

The full year contains 61,074,000 ticks and 1,017,900 candles. Use date ranges for tests and benchmarks; full-year generation is intentionally on demand.

## Cost baseline

Measured on 2026-09-15 on a Windows development host using Python 3.13, DuckDB 1.5.5, NumPy 2.5.3, and PyArrow 25.0.1:

| Range | Ticks | Candles | Generation plus validation | Compressed archive |
| --- | ---: | ---: | ---: | ---: |
| One day | 234,000 | 3,900 | 2.11 s | 5.94 MiB |
| One week (five weekdays) | 1,170,000 | 19,500 | 7.40 s | 29.62 MiB |
| Full year estimate from weekly rate | 61,074,000 | 1,017,900 | about 6.4 min | about 1.51 GiB |

Docker/PostgreSQL were unavailable on that host and its process launcher did not expose trustworthy peak memory, so those values are not fabricated. The Jenkins two-day integration publishes GNU `time -v` generation/import measurements, compressed archive bytes, and `pg_database_size`. Use a completed native-agent one-day and one-week run to report database/index size, disk growth, and full-year projections.
