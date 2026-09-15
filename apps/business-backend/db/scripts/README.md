# Synthetic market-data scripts

Run these cross-platform Python entrypoints from the repository root, in numeric order. Install `requirements.txt` first. The archive defaults to `apps/business-backend/db/seeds/synthetic-market-data-2026-v1`.

For the normal end-to-end workflow on Windows, use the single PowerShell entrypoint. It creates the virtual environment when needed, installs dependencies, generates or reuses the archive, carries the completed validation forward to the importer, and displays progress bars:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

Add `-InitializeDisposableDatabase` only for a first-time disposable setup; it runs the destructive V001 bootstrap. `-Regenerate`, `-Replace`, `-StartDate`, `-EndDate`, `-AvailableDiskGb`, and `-TickStorage` map to the corresponding workflow options. `-TickStorage parquet` is the default and keeps raw ticks in the validated archive instead of PostgreSQL.

1. `0001-initialize-database.py --database-url URL --disposable-database` applies V001 then V002. This is destructive first-time setup only. Never use it for ordinary seeding.
2. `0002-generate-synthetic-market-data.py [--start-date YYYY-MM-DD --end-date YYYY-MM-DD]` creates ticks and derived candles without database access. An old candle-only or different archive requires `--regenerate`; replacement is validated in staging before publication.
3. `0003-validate-synthetic-market-data.py` verifies checksums, exact one-second coverage, sequence uniqueness, spreads, and candle agreement without database access.
4. `0004-import-synthetic-market-data.py --database-url URL [--tick-storage parquet|postgres] [--replace] [--available-disk-gb N]` validates again and imports one calendar month per transaction with bounded PostgreSQL COPY batches. Parquet mode imports candles and records archived tick metadata; PostgreSQL mode also imports raw ticks. It displays a separate 0–100% progress bar for every month. Completed month checkpoints are verified and skipped on restart. The session remains `RUNNING` until every requested month is verified, then becomes `COMPLETED`.

The importer checks free space before each pending month. It reads PostgreSQL's `data_directory` when that path is accessible from the importer. For a remote server or separate container, pass `--available-disk-gb` or set `MARKET_DATA_AVAILABLE_DISK_GB`; otherwise it fails closed. Parquet mode estimates only candle/index growth and candle working space. PostgreSQL mode also includes tick heap/index and WAL costs.

The conservative PostgreSQL-mode budget uses 512 bytes of persistent heap/index growth per tick and 384 bytes per candle, plus monthly working/WAL allowances of 256 bytes per tick and 192 bytes per candle. Parquet mode excludes the tick values. A 25% safety margin is applied. These are admission-control estimates, not measurements.

Do not delete the Parquet archive after a default import: it is the source of truth for raw ticks and is required for checkpoint verification and future replay. The database session JSON records its absolute location, manifest fingerprint, archived tick count, and database tick count. Future tick readers should use DuckDB or PyArrow against that archive; a replay API is not part of this workflow.

The full year contains 61,074,000 ticks and 1,017,900 candles. Use date ranges for tests and benchmarks; full-year generation is intentionally on demand.

## Cost baseline

Measured on 2026-09-15 on a Windows development host using Python 3.13, DuckDB 1.5.5, NumPy 2.5.3, and PyArrow 25.0.1:

| Range | Ticks | Candles | Generation plus validation | Compressed archive |
| --- | ---: | ---: | ---: | ---: |
| One day | 234,000 | 3,900 | 2.11 s | 5.94 MiB |
| One week (five weekdays) | 1,170,000 | 19,500 | 7.40 s | 29.62 MiB |
| Full year estimate from weekly rate | 61,074,000 | 1,017,900 | about 6.4 min | about 1.51 GiB |

Docker/PostgreSQL were unavailable on that host and its process launcher did not expose trustworthy peak memory, so those values are not fabricated. The Jenkins two-day integration publishes GNU `time -v` generation/import measurements, compressed archive bytes, and `pg_database_size`. Use a completed native-agent one-day and one-week run to report database/index size, disk growth, and full-year projections.
