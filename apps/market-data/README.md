# Market Data

Tooling that generates a year of synthetic market data and loads it into the `trading_season` database. The Java services replay it as the simulated market. The schema itself lives in [db/migrations](../../db/migrations) at the repository root; see [db/README.md](../../db/README.md).

Layout under `apps/market-data/db`:

| Path | Contents |
| --- | --- |
| `scripts/python/` | Numbered entry points, shared `lib/`, generation `config/`, requirements |
| `scripts/powershell/` | `setup-database.ps1` and `setup-market-data.ps1` launchers |
| `seeds/` | Generated archive (`synthetic-market-data-2026-v1`, gitignored) and [demo-trader.sql](db/seeds/demo-trader.sql), a development-only demo account |
| `scripts/notebooks/` | `view-market.ipynb` for inspecting data |
| `.venv/` | Python virtual environment (gitignored) |

## Pipeline

```mermaid
flowchart LR
    Gen["0002 generate<br/>one-second ticks and<br/>one-minute candles"] --> Archive[("Parquet archive<br/>db/seeds")]
    Archive --> Val["0003 validate<br/>checksums, coverage,<br/>sequences, spreads"]
    Val --> Imp["0004 import<br/>one month per transaction"]
    Imp --> DB[("trading_season<br/>candles, session metadata")]
    Archive -. "raw ticks stay in Parquet" .-> Replay["Java services replay"]
    DB --> Replay
    Init["0001 initialize<br/>empty database only"] -. "optional first step" .-> DB
```

| Step | Script | Notes |
| --- | --- | --- |
| 0001 | `0001-initialize-database.py --database-url URL --empty-database` | Applies V001 and V002 to an empty schema. Never use it for seeding |
| 0002 | `0002-generate-synthetic-market-data.py [--start-date D --end-date D] [--regenerate]` | No database access. Replacing a different archive needs `--regenerate` and is validated in staging |
| 0003 | `0003-validate-synthetic-market-data.py` | Checksums, exact one-second coverage, unique sequences, spreads, candle agreement |
| 0004 | `0004-import-synthetic-market-data.py --database-url URL [--tick-storage parquet\|postgres] [--replace] [--available-disk-gb N]` | Per-month checkpoints are verified and skipped on rerun. The session stays `RUNNING` until every month is verified |

The full year is 61,074,000 ticks and 1,017,900 candles (about 1.5 GiB compressed). Use a date range for tests. Parquet mode, the default, keeps raw ticks in the archive and imports only candles; do not delete the archive afterwards, since replay and checkpoint verification read it. `postgres` mode also loads raw ticks and needs far more disk.

The importer checks free disk before each month. For a remote or containerized database, pass `--available-disk-gb` or set `MARKET_DATA_AVAILABLE_DISK_GB`, otherwise it fails closed.

## Run on Windows

From the repository root, with a migrated empty database ([db/README.md](../../db/README.md)):

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/market-data/db/scripts/powershell/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

The launcher creates the virtual environment, installs dependencies, then generates, validates, and imports. Useful switches: `-StartDate`/`-EndDate` (for example `2026-01-05` to `2026-01-06`), `-Regenerate`, `-Replace`, `-TickStorage`, and `-InitializeDisposableDatabase` for a first-time empty database only. `setup-database.ps1 -DatabaseUrl URL` applies just V001 and V002.

On Linux, run the numbered scripts directly with Python 3 after `pip install -r apps/market-data/db/scripts/python/requirements.txt` (CI uses the smaller `requirements-ci.txt`).

## Docker and CI

- Local Compose runs `db-init` (all migrations) automatically; its opt-in `initialize` and `seed` profiles run the steps above. Set `MARKET_DATA_AVAILABLE_DISK_GB` before using `seed`.
- Jenkins builds [Dockerfile.market-data](../../infrastructure/docker/Dockerfile.market-data) and runs a two-day integration: initialize, restart the database, generate, validate, then import twice.
- `python apps/market-data/db/scripts/python/tests/test_watchlist_migration.py` validates the watchlist migration against a disposable cluster when PostgreSQL binaries are on `PATH`.
