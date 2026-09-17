# Database

## Two separate stores

The Java business backend and NestJS auth service have separate PostgreSQL databases and user models. The only value shared between them is the user's UUID: auth_db users.id equals trading_season users.user_id, and it reaches the Java backend as the access token's sub claim. Credentials, lockout and refresh sessions exist only in auth_db.

| Store | Schema source | Application behavior |
| --- | --- | --- |
| Business: trading_season | [V001 bootstrap SQL](../../apps/business-backend/db/migrations/V001__Initial_schema.sql) plus incremental SQL such as [V002 synthetic market data replay metadata](../../apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql) and [V003 token authentication](../../apps/business-backend/db/migrations/V003__Token_authentication.sql) | Hibernate ddl-auto=none; no Flyway dependency or automatic migration runner |
| Auth: auth_db | [TypeORM migrations](../../apps/auth-service/src/database/migrations/) | Migrations run on startup; synchronize=false |

The business bootstrap defines more of the trading model than the currently implemented Java auth API. The ERD below is the canonical diagram; SQL remains authoritative for exact columns and constraints.

## Business model

| Group | Tables and responsibility |
| --- | --- |
| Identity | users: profile, funds and account settings, keyed by the auth service user UUID; no credentials |
| Simulation/reference | simulation_sessions, stocks, instruments: reproducible runs and tradable assets |
| Market data | market_states, market_behaviors, quotes, market_ticks, candles: state, history, replay data |
| Accounts/execution | accounts, holdings, orders, fills: balances, positions, instructions and executions |
| Ledgers/audit | cash_transactions, holding_movements, audit_trail: accounting and event history |

Orders are distinct from fills. The schema allows at most one fill per order. The account/client_reference pair supplies order idempotency. Cash balances and holdings are caches reconciled against append-only ledgers. Application grants should limit ledger/audit access to the appropriate insert/read operations; table definitions alone do not enforce every operational policy.

Simulation data is scoped by run and stock. Deleting a simulation session cascades through its generated market data. The optional unique instruments.simulated_stock_symbol connects U.S. equity instruments to simulator stocks. V002 adds replay metadata and uniqueness needed by synthetic market data imports; it does not add trading APIs. Trading schema support for other asset classes does not imply their simulation or APIs are implemented.

## Disposable business database setup

Use this setup for a local development database whose contents can be discarded. `V001__Initial_schema.sql` drops and recreates tables, so it is not a safe upgrade path for retained data. `V002__Synthetic_market_data_replay_metadata.sql` is applied after V001, then `V003__Token_authentication.sql`. V003 removes the sessions table, the username column, and the users credential columns (password hash, lockout, reset token, last login), drops the user_id default because the application sets it from the token, and adds a case-insensitive unique index on email. Any stored password hashes and sessions are discarded.

### Connection values

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `trading_season` |
| User | `trading_season` |
| Password | local value, for example `password` |

The application default password remains `changeme`; override it locally with `SPRING_DATASOURCE_PASSWORD` or `DATABASE_URL` when your database uses a different password.

### First-time pgAdmin setup

Connect to the default `postgres` database as your PostgreSQL admin user. In pgAdmin Query Tool, run these commands one at a time because `CREATE DATABASE` cannot run inside a transaction block:

```sql
CREATE ROLE trading_season WITH LOGIN PASSWORD 'password';
```

```sql
CREATE DATABASE trading_season OWNER trading_season;
```

If the role or database already exists, skip the command that created it.

### Apply the schema

Connect pgAdmin Query Tool to the `trading_season` database as the `trading_season` user, then run these files in order. Tables belong to the user that creates them, so running the files as your admin user leaves `trading_season` without table access even though it owns the database.

1. `apps/business-backend/db/migrations/V001__Initial_schema.sql`
2. `apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql`
3. `apps/business-backend/db/migrations/V003__Token_authentication.sql`

With `psql`, the equivalent commands from the repository root are:

```sh
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V001__Initial_schema.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V003__Token_authentication.sql
```

A database already initialized with V001 and V002 only needs V003 applied.

### Verify the schema

Run this in `trading_season`:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see tables such as `users`, `stocks`, `simulation_sessions`, `quotes`, `market_ticks`, and `candles`.

Confirm that `trading_season` owns them:

```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

If another user owns the tables, scripts connecting as `trading_season` fail with `InsufficientPrivilegeError: permission denied for table ...`. A wrong password fails earlier, at login, with `InvalidPasswordError`. To fix ownership, connect to the `trading_season` database as the owning admin user and run:

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO trading_season', r.tablename);
  END LOOP;
END $$;
```

Changing a table's owner also transfers its indexes and owned sequences.

### Optional synthetic market data generation and import

The generated `2026-v1` archive is stored locally in `apps/business-backend/db/seeds/synthetic-market-data-2026-v1` and is not committed to Git. A full archive contains 61,074,000 one-second ticks and 1,017,900 tick-derived one-minute candles.

Run the complete routine workflow from the repository root with one command. It creates the virtual environment if needed, installs dependencies, generates or reuses the archive, carries the completed validation forward to the importer, and displays progress while loading PostgreSQL:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

For a small archive, add `-StartDate 2026-01-05 -EndDate 2026-01-06`. Add `-Regenerate` to replace an incompatible archive or `-Replace` to replace a different import for the same session. On a brand-new disposable database, add `-InitializeDisposableDatabase`; this drops and recreates the business tables. `-AvailableDiskGb` supplies free space on the PostgreSQL server when its data directory is not accessible from the script process. `-TickStorage parquet` is the default; use `-TickStorage postgres` only when raw ticks must be queried in SQL and the database has sufficient capacity.

The individual commands below remain available for troubleshooting and non-Windows environments. Run them from the repository root.

#### Step 1: Install the Python dependencies

Create the virtual environment and install its dependencies once:

```powershell
py -3 -m venv apps/business-backend/db/.venv
apps/business-backend/db/.venv/Scripts/python.exe -m pip install --upgrade pip
apps/business-backend/db/.venv/Scripts/python.exe -m pip install -r apps/business-backend/db/scripts/requirements.txt
```

#### Step 2: Initialize a disposable database

Run this step only when setting up the business database for the first time. It applies V001, V002 and V003, and V001 drops existing tables.

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0001-initialize-database.py `
  --database-url postgresql://trading_season:password@localhost:5432/trading_season `
  --disposable-database
```

Do not run step 2 during ordinary seeding.

#### Step 3: Generate the archive

Generation does not access PostgreSQL:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0002-generate-synthetic-market-data.py
```

For a smaller test archive, add a date range:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0002-generate-synthetic-market-data.py `
  --start-date 2026-01-05 `
  --end-date 2026-01-06
```

If an older candle-only or otherwise incompatible archive exists, add `--regenerate`. The replacement is validated in a staging directory before it is published.

#### Step 4: Validate the archive

Validation does not access PostgreSQL:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0003-validate-synthetic-market-data.py
```

#### Step 5: Import the archive

The importer validates the archive again and commits one calendar month at a time. By default, raw ticks remain in Parquet and only candles are copied into PostgreSQL:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0004-import-synthetic-market-data.py `
  --tick-storage parquet `
  --database-url postgresql://trading_season:password@localhost:5432/trading_season
```

Use `--tick-storage postgres` only for an intentional high-storage tick import. The storage mode is part of the session identity; changing it for an existing session requires `--replace`.

Before each pending month, the importer checks available database storage against a conservative estimate for remaining heap/index growth, monthly working space, and a safety margin. It reads PostgreSQL's `data_directory` when the database user has permission and the path is locally accessible. If the setting or server path is inaccessible, the import stops unless `--available-disk-gb` or `MARKET_DATA_AVAILABLE_DISK_GB` provides the server's actual free space. Elevated PostgreSQL privileges are not required when using this override.

Pass the actual free GiB for the filesystem containing PostgreSQL data. Do not inflate the override to bypass the capacity check.

Each successful month is recorded in `simulation_sessions.config` and committed while the session remains `RUNNING`. In Parquet mode, a checkpoint records the archived tick count, zero database ticks, imported candle count, storage mode, and file fingerprint. Rerunning the same command verifies the Parquet fingerprint and SQL candle rows, skips completed months, and resumes with the first incomplete month. After all requested months and final totals are verified, the session becomes `COMPLETED`.

The terminal displays a separate progress bar for each month, labeled `Month 1/12`, `Month 2/12`, and so on. Each bar advances through disk checking, partition loading, retaining ticks in Parquet or inserting them into PostgreSQL, candle verification, and commit. Previously completed months display as verified and skipped.

An identical completed import is skipped. If the target session contains different or candle-only data, add `--replace`. The replacement affects only that simulation session; unrelated sessions and records are preserved.

#### Step 6: Verify the imported data in pgAdmin

Connect pgAdmin's Query Tool to the `trading_season` database and run:

```sql
SELECT 'stocks' AS table_name, COUNT(*) AS row_count FROM stocks
UNION ALL
SELECT 'simulation_sessions', COUNT(*) FROM simulation_sessions WHERE id = 2026001
UNION ALL
SELECT 'market_states', COUNT(*) FROM market_states WHERE session_id = 2026001
UNION ALL
SELECT 'market_behaviors', COUNT(*) FROM market_behaviors WHERE session_id = 2026001
UNION ALL
SELECT 'market_ticks', COUNT(*) FROM market_ticks WHERE session_id = 2026001
UNION ALL
SELECT 'candles', COUNT(*) FROM candles WHERE session_id = 2026001
ORDER BY table_name;
```

For a full-year archive in the default Parquet mode, `market_ticks` should contain 0 rows and `candles` should contain 1,017,900 rows. The 61,074,000 raw ticks remain in the archive. PostgreSQL tick mode stores all 61,074,000 ticks. A date-range archive has smaller totals.

Check the imported symbols and timestamp coverage:

```sql
SELECT
    COUNT(DISTINCT symbol) AS symbols,
    MIN("timestamp") AS first_tick,
    MAX("timestamp") AS last_tick
FROM market_ticks
WHERE session_id = 2026001;
```

View a small sample of the generated ticks and candles:

```sql
SELECT *
FROM market_ticks
WHERE session_id = 2026001
ORDER BY "timestamp", symbol
LIMIT 20;

SELECT *
FROM candles
WHERE session_id = 2026001
ORDER BY "timestamp", symbol
LIMIT 20;
```

These examples use the default synthetic session ID `2026001`. Replace it if the importer was run with a different `--session-id` value.

View the session state and completed monthly checkpoints:

```sql
SELECT
    id,
    status,
    config -> 'tick_storage' ->> 'mode' AS tick_storage,
    config -> 'tick_storage' ->> 'archive_location' AS archive_location,
    config -> 'tick_storage' ->> 'archived_ticks' AS archived_ticks,
    config -> 'tick_storage' ->> 'database_ticks' AS database_ticks,
    config -> 'import_checkpoint' -> 'completed_months' AS completed_months
FROM simulation_sessions
WHERE id = 2026001;
```

`RUNNING` means one or more committed months may be available but the requested archive is incomplete. Consumers should normally use only `COMPLETED` sessions.

In Parquet mode, keep the archive at the recorded location. Deleting it removes the raw tick history and prevents checkpoint verification. DuckDB and PyArrow can read the daily tick partitions directly; live replay and query APIs remain outside this workflow.

Confirm the committed tick and candle totals for each month:

```sql
SELECT
    month,
    SUM(ticks) AS ticks,
    SUM(candles) AS candles
FROM (
    SELECT DATE_TRUNC('month', "timestamp") AS month, COUNT(*) AS ticks, 0 AS candles
    FROM market_ticks
    WHERE session_id = 2026001
    GROUP BY 1
    UNION ALL
    SELECT DATE_TRUNC('month', "timestamp") AS month, 0 AS ticks, COUNT(*) AS candles
    FROM candles
    WHERE session_id = 2026001
    GROUP BY 1
) monthly_counts
GROUP BY month
ORDER BY month;
```

If an import fails with `DiskFullError`, free server storage before retrying. A regular vacuum makes pages from an aborted transaction reusable without deleting unrelated sessions:

```sql
VACUUM market_ticks;
VACUUM candles;
```

Inspect the current heap and index allocation before maintenance:

```sql
SELECT
    relname,
    pg_size_pretty(pg_relation_size(oid)) AS heap_size,
    pg_size_pretty(pg_indexes_size(oid)) AS index_size,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relname IN ('market_ticks', 'candles')
ORDER BY relname;
```

Regular vacuum does not necessarily return allocated files to the operating system. If `market_ticks` remains large after the failed import, a database administrator can consider `VACUUM FULL market_ticks;`. It takes an exclusive table lock, rewrites the relation, and can require additional temporary disk capacity. Do not truncate shared market-data tables unless an operator has independently confirmed that no unrelated tick data exists.

For later routine seeding, run steps 3 through 6 only. The import adds stocks, simulation metadata, market behaviors, market states, ticks, and candles. It does not add users, accounts, orders, holdings, auth-service data, or quotes.

There is no Flyway runner in the Java backend; these files are applied manually.

## Auth migrations

[Runtime configuration](../../apps/auth-service/src/config/database.config.ts) and the [CLI data source](../../apps/auth-service/src/database/data-source.ts) must retain matching entity and migration lists. The initial schema creates auth users and refresh-token storage; a later migration added a required username and TrimUserToBrsMinimum removed it along with first and last name, so email is the only login identifier.

From apps/auth-service, npm run migration:show and npm run migration:run inspect/apply migrations. Export the matching database environment variables before invoking the CLI: its data source does not itself load dotenv. Normal application startup loads .env and runs migrations automatically.

Refresh tokens are stored as hashes with expiry, revocation, and rotation metadata. See the [auth README](../../apps/auth-service/README.md) for connection and key setup.

## Change rules

Add incremental migrations rather than editing already applied files. For business changes, explicitly document the application procedure because no migration runner is installed. Review SQL, affected entity mappings, and the ERD together. Use test fixtures instead of production identities or secrets. Back up retained data and verify migrations on a disposable copy before deployment.

# Business database ERD

Canonical relationship diagram for the business SQL schema after V001, V002 and V003. SQL defines exact columns and constraints. See this database reference for ownership, initialization, and change rules.

The optional instruments.simulated_stock_symbol links an instrument to a simulator stock. Market data belongs to a simulation session and stock. Keep this diagram synchronized when schema relationships change.

```mermaid
erDiagram
    users ||--o{ accounts : owns

    stocks o|--o| instruments : "optionally powers"

    simulation_sessions ||--o{ market_states : contains
    simulation_sessions ||--o{ market_behaviors : contains
    simulation_sessions ||--o{ quotes : contains
    simulation_sessions ||--o{ market_ticks : contains
    simulation_sessions ||--o{ candles : contains

    stocks ||--o{ market_states : describes
    stocks ||--o{ market_behaviors : receives
    stocks ||--o{ quotes : quoted_as
    stocks ||--o{ market_ticks : traded_as
    stocks ||--o{ candles : aggregated_as

    accounts ||--o{ holdings : has
    instruments ||--o{ holdings : held_as
    accounts ||--o{ orders : submits
    instruments ||--o{ orders : targets

    orders ||--o| fills : executes_as
    orders ||--o{ audit_trail : records
    accounts ||--o{ cash_transactions : posts
    fills o|--o| cash_transactions : creates
    accounts ||--o{ holding_movements : posts
    instruments ||--o{ holding_movements : changes
    fills ||--o| holding_movements : creates

    users {
        UUID user_id PK
        TEXT email UK
        TEXT user_role
        TEXT account_status
    }
    simulation_sessions {
        BIGINT id PK
        INTEGER seed
        DOUBLE drift
        JSONB config
        INTEGER config_version
        TEXT status
        TEXT failure_code
        TEXT failure_detail
        TIMESTAMPTZ started_at
        TIMESTAMPTZ ended_at
    }
    stocks {
        VARCHAR symbol PK
        TEXT company_name
        NUMERIC starting_price
        BIGINT average_volume
        NUMERIC base_volatility
    }
    instruments {
        INTEGER instrument_id PK
        TEXT ticker UK
        TEXT asset_class
        TEXT market
        VARCHAR simulated_stock_symbol FK
    }
    accounts {
        INTEGER account_id PK
        UUID user_id FK
        NUMERIC cash_balance
        TEXT currency
    }
    market_states {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT trend
        NUMERIC volatility
        NUMERIC liquidity
        NUMERIC momentum
    }
    market_behaviors {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT behavior_type
        TIMESTAMPTZ start_time
        NUMERIC duration_seconds
        NUMERIC strength
    }
    quotes {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TIMESTAMPTZ timestamp
        NUMERIC bid
        NUMERIC ask
    }
    market_ticks {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TIMESTAMPTZ timestamp
        NUMERIC price
        BIGINT sequence_number
    }
    candles {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT interval
        TIMESTAMPTZ timestamp
        NUMERIC open
        NUMERIC high
        NUMERIC low
        NUMERIC close
        BIGINT volume
    }
    holdings {
        INTEGER holding_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        NUMERIC quantity
    }
    orders {
        INTEGER order_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        UUID client_reference UK
        TEXT order_type
        TEXT status
        NUMERIC quantity
    }
    fills {
        INTEGER fill_id PK
        INTEGER order_id FK
        NUMERIC quote_price
        NUMERIC quantity
    }
    cash_transactions {
        INTEGER cash_transaction_id PK
        INTEGER account_id FK
        INTEGER fill_id FK
        NUMERIC amount
        TEXT reason
    }
    holding_movements {
        INTEGER holding_movement_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        INTEGER fill_id FK
        NUMERIC quantity_delta
    }
    audit_trail {
        INTEGER audit_id PK
        INTEGER order_id FK
        TEXT event_type
        TIMESTAMPTZ recorded_at
    }
```
