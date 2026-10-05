# Database

## One database, two owners

The Java services and NestJS auth service share `trading_season`. Credentials are stored in `user_accounts`; customer profiles are stored separately in `users` with the same UUID.

An account and its profile are separate rows joined by the same UUID, which is also the access token's `sub` claim: `user_accounts.user_id` equals `users.user_id`, and a foreign key from `users` prevents a profile existing without credentials behind it.

The auth service previously used a database of its own, `auth_db`. the former auth consolidation moved its tables here and the former profile cleanup dropped the copies of `email`, `user_role` and `account_status` that `users` had been carrying.

| Table group | Schema source | Application behavior |
| --- | --- | --- |
| Business: trading_season | [Canonical schema](../../apps/market-data/db/migrations/V001__Initialize_database.sql) | Hibernate ddl-auto=none; explicit first-time setup |
| Business tables | [Market Data schema](../../apps/market-data/README.md) | Hibernate ddl-auto=none; no Flyway dependency or automatic migration runner |
| user_accounts, refresh_tokens | the canonical schema | TypeORM with synchronize=false and no migration runner; the auth service reads and writes tables it never creates |

The business bootstrap defines more of the trading model than the currently implemented Java auth API. The ERD below is the canonical diagram; SQL remains authoritative for exact columns and constraints.

## Service ownership in trading_season

Portfolio history is defined in [V001__Initialize_database.sql](../../apps/market-data/db/migrations/V001__Initialize_database.sql): `portfolio_valuations` stores account observations, with an account/time index and a cascading account foreign key.

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V001__Initialize_database.sql
```

Both Java services share the same `trading_season` database. This table lists which service has primary responsibility for each table:

| Table | Owned by | Access |
| --- | --- | --- |
| user_accounts | Auth Service | Read/write (credentials, role, lockout); Java services read only |
| refresh_tokens | Auth Service | Read/write (issue, rotate, revoke); Java services never read it |
| users | Holdings and Trade Service | Read/write (profile, funds, settings) |
| accounts | Holdings and Trade Service | Read/write (account management) |
| orders | Order and Sell Service | Read/write (order lifecycle) |
| fills | Order and Sell Service | Read/write (execution results) |
| holdings | Order and Sell Service | Writes positions; Holdings and Trade reads them |
| portfolio_valuations | Holdings and Trade Service | Append/read (real-time portfolio history) |
| cash_transactions | Both Java services | Cash transfers in Holdings and Trade; execution ledger in Order and Sell |
| holding_movements | Order and Sell Service | Read/write (position ledger) |
| audit_trail | Order and Sell Service | Read/write (event history) |
| stocks | Holdings and Trade Service | Read/write (reference data) |
| instruments | Order and Sell Service | Read/write (tradable assets) |
| simulation_sessions | Holdings and Trade Service | Read/write (simulation metadata) |
| market_states | Holdings and Trade Service | Read/write |
| market_behaviors | Holdings and Trade Service | Read/write |
| market_ticks | Holdings and Trade Service | Read/write |
| candles | Holdings and Trade Service | Read/write |
| quotes | Holdings and Trade Service | Read (market snapshots) |
| user_watchlist | Holdings and Trade Service | Read/write (saved stocks per user) |

Both Java services connect to the same database. Order and Sell implements order validation and execution; Holdings and Trade implements caller-owned profiles, accounts, holdings queries, cash, watchlists, and market data. See the [service boundaries](architecture.md#service-boundaries).

## Watchlist migration

[V002__Add_watchlist.sql](../../apps/market-data/db/migrations/V002__Add_watchlist.sql) adds `user_watchlist` with a composite `(user_id, symbol)` primary key, an addition timestamp, and cascading foreign keys to `users` and `stocks`. Holdings and Trade owns its reads and writes. Watchlists belong to users rather than trading accounts.

Fresh setup through the Python initializer or Compose applies V001 followed by V002. There is no automatic Java migration runner. For an existing database, apply only V002 as the database owner before starting the updated application:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V002__Add_watchlist.sql
```

V002 preserves existing data and may be reapplied without resetting membership. V001 remains unchanged. Fresh databases now contain 20 application tables; legacy databases retaining `sessions` contain 21. Validate the upgrade against an isolated temporary PostgreSQL cluster with:

```powershell
python apps/market-data/db/scripts/python/tests/test_watchlist_migration.py
```

The test requires PostgreSQL binaries on PATH and never connects to an existing database.

## Business model

| Group | Tables and responsibility |
| --- | --- |
| Identity | users: profile, funds and account settings, keyed by the auth service user UUID; no credentials |
| Simulation/reference | simulation_sessions, stocks, instruments: reproducible runs and tradable assets |
| Market data | market_states, market_behaviors, quotes, market_ticks, candles: state, history, replay data |
| Accounts/execution | accounts, holdings, orders, fills: balances, positions, instructions and executions |
| Ledgers/audit | cash_transactions, holding_movements, audit_trail: accounting and event history |

Orders are distinct from fills. The schema allows at most one fill per order. The account/client_reference pair supplies order idempotency. An order's status is PENDING, FILLED or REJECTED . Buy and sell orders move users.available_funds; accounts.cash_balance is not moved by order execution. Cash balances and holdings are caches reconciled against append-only ledgers. Application grants should limit ledger/audit access to the appropriate insert/read operations; table definitions alone do not enforce every operational policy.

Simulation data is scoped by run and stock. Deleting a simulation session cascades through its generated market data. The unique `instruments.simulated_stock_symbol` connects simulated U.S. equities to instruments. The [market-data importer](../../apps/market-data/db/scripts/python/lib/importing.py) creates these instrument rows idempotently. Schema support for other asset classes does not imply their simulation APIs exist.

Setup wrappers require an empty public schema. For an existing legacy database missing three application tables, use the direct V001 repair command below; other upgrades require a separately reviewed change.

### Dummy trader with January–October history

`orders.simulated_at` records the replay time selected at submission independently of real audit and fill timestamps.

In pgAdmin, open Query Tool for your local `trading_season` database, open the seed file, and execute the entire file. If a previous attempt left the connection in an aborted transaction, run `ROLLBACK;` first. The seed is plain SQL and also runs from repository root with:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/seeds/seed-demo-trader-2026.sql
```

The seed uses session `2026001` by default; edit `session_id` in the file's `demo_seed_options` statement to select another imported session with the same 2026 coverage. Sign in with the email above and the development password supplied for this seed. Only its bcrypt hash is stored in the SQL file, using the auth service's cost factor of 10. Both credentials satisfy the signup email and password-length rules. To use a different password on first insertion, edit the empty `password` SQL literal in `demo_seed_options` (8–72 UTF-8 bytes); keep local password overrides out of version control.

The account starts with $50,000 and makes 51 whole-share executions from January 5 through October 1, 2026. AAPL, MSFT, NVDA, JPM, XOM, and TSLA form a diversified starting portfolio, followed by monthly buying, trimming, liquidation, and re-entry. This is 2026 year-to-date history, not a trailing twelve months. Prices come from the existing synthetic simulation archive, not historical exchange prices. Each order fills at an available one-minute candle close, with `simulated_at` set to the completed minute; weekend requests move to the next available archive bucket within seven days. Missing instruments/prices, insufficient cash, or insufficient shares abort the entire transaction.

The seed writes matching orders, fills, holdings, cash transactions, holding movements, and audit events. Opening funding is the shared starting budget, and `users.available_funds` matches the signed cash ledger. Real audit timestamps record the import time; only `orders.simulated_at` carries the historical replay date. Historical portfolio charts reconstruct positions from these orders and archived prices, so the seed does not manufacture historical valuation observations. Use the dashboard or market page's time dropdown to review October 1 or rewind the history.

A repeat run leaves the existing demo's password, funds, holdings, and any later trades unchanged. Conflicting identities fail rather than overwrite another login. The seed prints the account ID, cash balance, order count, and first/last simulated execution times after completion.

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

The canonical [V001__Initialize_database.sql](../../apps/market-data/db/migrations/V001__Initialize_database.sql) defines all 19 application tables in their current form. Apply it as the `trading_season` owner. It uses one transaction to initialize an empty public schema or repair the legacy missing-table layout described below, and never drops existing data.

```powershell
apps/market-data/db/scripts/powershell/setup-database.ps1 -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season
```

Alternatively, open `V001__Initialize_database.sql` in pgAdmin connected to `trading_season` and execute the entire file, or apply V001 with `psql -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V001__Initialize_database.sql` using the same connection. Then apply V002 using the [watchlist migration](#watchlist-migration) command. The script does not create the database or role, or import market data. Historical numbered migrations and repair files have been consolidated; existing databases require a separately reviewed upgrade except for the bounded legacy repair below.

### Upgrade a legacy 17-table database

If your table list includes `sessions` but lacks `user_accounts`, `refresh_tokens`, and `portfolio_valuations`, apply [V001__Initialize_database.sql](../../apps/market-data/db/migrations/V001__Initialize_database.sql) once as the database owner:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V001__Initialize_database.sql
```

This transactional upgrade requires `users` and `accounts` to exist and all three added tables to be absent. It creates the missing tables, constraints, indexes, and portfolio valuation sequence using the current baseline definitions. It preserves existing rows and the legacy `sessions` table, so the V001 repair leaves 20 tables: the 19 baseline application tables plus `sessions`. Apply [V002](#watchlist-migration) afterward to bring it to 21 tables. Do not drop `sessions` just to match a count.

The added tables start empty; schema setup does not seed credentials or portfolio observations. Existing profiles retain their UUIDs and are not assigned invented passwords. The profile-to-credentials foreign key is added as `NOT VALID`, matching V001, so existing unmatched profiles remain but new profile writes require credentials. Legacy profile columns and session dependencies require a separate upgrade assessment; this repair does not fully convert an older schema. The repair branch refuses databases where any of these three tables already exist, including an already initialized current schema. Setup wrappers still require an empty schema; use the direct psql command above for the legacy repair.

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

On Linux, check the actual free space on the filesystem containing PostgreSQL data before importing and pass that value to `--available-disk-gb`. The storage-aware setup script deliberately does not start an import. For example, when PostgreSQL data and the repository use the root filesystem:

```sh
free_disk_gb="$(df -Pk / | awk 'NR == 2 { print $4 / 1048576 }')"
python3 -m venv apps/market-data/db/.venv
apps/market-data/db/.venv/bin/python -m pip install -r apps/market-data/db/scripts/python/requirements.txt
apps/market-data/db/.venv/bin/python apps/market-data/db/scripts/python/0004-import-synthetic-market-data.py \
  --tick-storage parquet \
  --available-disk-gb "$free_disk_gb" \
  --database-url postgresql://trading_season:password@localhost:5432/trading_season
```

Do not inflate the reported value or run this command until the archive has been copied and validated. The importer performs an additional capacity check before each pending month.

The generated `2026-v1` archive is stored locally in `apps/market-data/db/seeds/synthetic-market-data-2026-v1` and is not committed to Git. A full archive contains 61,074,000 one-second ticks and 1,017,900 tick-derived one-minute candles.

Run the complete routine workflow from the repository root with one command. It creates the virtual environment if needed, installs dependencies, generates or reuses the archive, carries the completed validation forward to the importer, and displays progress while loading PostgreSQL:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/market-data/db/scripts/powershell/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

For a small archive, add `-StartDate 2026-01-05 -EndDate 2026-01-06`. Add `-Regenerate` to replace an incompatible archive or `-Replace` to replace a different import for the same session. On a brand-new disposable database, add `-InitializeDisposableDatabase`; this drops and recreates the business tables. `-AvailableDiskGb` supplies free space on the PostgreSQL server when its data directory is not accessible from the script process. `-TickStorage parquet` is the default; use `-TickStorage postgres` only when raw ticks must be queried in SQL and the database has sufficient capacity.

The individual commands below remain available for troubleshooting and non-Windows environments. Run them from the repository root.

#### Step 1: Install the Python dependencies

Create the virtual environment and install its dependencies once:

```powershell
py -3 -m venv apps/market-data/db/.venv
apps/market-data/db/.venv/Scripts/python.exe -m pip install --upgrade pip
apps/market-data/db/.venv/Scripts/python.exe -m pip install -r apps/market-data/db/scripts/python/requirements.txt
```

#### Step 2: Initialize a disposable database

The initializer requires an empty schema and does not drop existing tables.

```powershell
apps/market-data/db/.venv/Scripts/python.exe apps/market-data/db/scripts/python/0001-initialize-database.py `
  --database-url postgresql://trading_season:password@localhost:5432/trading_season `
  --disposable-database
```

Do not run step 2 during ordinary seeding.

#### Step 3: Generate the archive

Generation does not access PostgreSQL:

```powershell
apps/market-data/db/.venv/Scripts/python.exe apps/market-data/db/scripts/python/0002-generate-synthetic-market-data.py
```

For a smaller test archive, add a date range:

```powershell
apps/market-data/db/.venv/Scripts/python.exe apps/market-data/db/scripts/python/0002-generate-synthetic-market-data.py `
  --start-date 2026-01-05 `
  --end-date 2026-01-06
```

If an older candle-only or otherwise incompatible archive exists, add `--regenerate`. The replacement is validated in a staging directory before it is published.

#### Step 4: Validate the archive

Validation does not access PostgreSQL:

```powershell
apps/market-data/db/.venv/Scripts/python.exe apps/market-data/db/scripts/python/0003-validate-synthetic-market-data.py
```

#### Step 5: Import the archive

The importer validates the archive again and commits one calendar month at a time. By default, raw ticks remain in Parquet and only candles are copied into PostgreSQL:

```powershell
apps/market-data/db/.venv/Scripts/python.exe apps/market-data/db/scripts/python/0004-import-synthetic-market-data.py `
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

There is no Flyway runner in the Java backend; schema setup is explicit.

## Auth tables

`user_accounts` and `refresh_tokens` are defined in the canonical schema. The auth service registers no migrations and assumes the schema has already been initialized.

The service therefore assumes V001__Initialize_database.sql has already been applied. If it has not, its queries fail against missing columns, which is louder than quietly building a second schema alongside the first.

Email is the only login identifier, unique without regard to case through `user_accounts_email_lower_key`. Refresh tokens are stored as SHA-256 hashes with expiry, revocation and rotation metadata; the raw value is returned to the client once and never persisted. See the [auth README](../../apps/auth-service/README.md) for connection and key setup.

## Change rules

Keep `apps/market-data/db/migrations/V001__Initialize_database.sql` as the canonical definition for new databases. Update affected entity mappings and documentation together. V001 includes the bounded missing-table repair described above. Other changes to retained databases require a separately reviewed incremental upgrade; setup wrappers never upgrade or reset them. Back up retained data and verify upgrades on a disposable copy.

# Business database ERD

Canonical relationship diagram for the SQL schema in V001__Initialize_database.sql. SQL defines exact columns and constraints. See this database reference for ownership, initialization, and change rules.

The optional instruments.simulated_stock_symbol links an instrument to a simulator stock. Market data belongs to a simulation session and stock. Keep this diagram synchronized when schema relationships change.

```mermaid
erDiagram
    user_accounts ||--|| users : "credentials for"
    user_accounts ||--o{ refresh_tokens : issues
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

    accounts ||--o{ portfolio_valuations : values
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

    user_accounts {
        UUID user_id PK
        TEXT email UK
        TEXT password_hash
        TEXT user_role
        TEXT account_status
        INTEGER failed_login_attempts
        TIMESTAMPTZ locked_until
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    refresh_tokens {
        UUID id PK
        UUID user_id FK
        TEXT token_hash UK
        TIMESTAMPTZ issued_at
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ revoked_at
        UUID replaced_by
    }
    users {
        UUID user_id PK, FK
        TEXT first_name
        TEXT middle_name
        TEXT last_name
        TEXT ssn
        TEXT address
        DATE date_of_birth
        TEXT trader_level
        NUMERIC available_funds
        INTEGER session_timeout_minutes
        NUMERIC execution_buffer_percent
        TIMESTAMPTZ last_activity_at
        TIMESTAMPTZ created_at
    }
    portfolio_valuations {
        BIGINT valuation_id PK
        INTEGER account_id FK
        TIMESTAMPTZ observed_at
        NUMERIC portfolio_value
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

`orders.simulated_at` records the replay time selected at submission independently of real audit and fill timestamps.

## SQL file naming convention

Store SQL files in `apps/market-data/db/migrations` and name them `VNNN__Verb_description.sql`: an uppercase `V`, a three-digit version, two underscores, and a readable description separated by underscores. The single fresh-database baseline is `V001__Initialize_database.sql`. Version numbers describe application order, not author identity; do not include developer names or separate INITDB counters.

For a future incremental change, use the next unused number, using `VNNN__Verb_description.sql`. Coordinate the number in the pull request and check the target branch before merging. If parallel changes select the same number, renumber the unmerged file; never rename or rewrite a migration already applied to a retained database. After version 999, expand all version prefixes consistently rather than mixing widths.

The setup command currently applies only V001 to an empty public schema. Adding another migration does not make it run automatically; an incremental migration runner or an explicit upgrade procedure must accompany that change. Jenkins retains the bounded archive generation, validation, import, and repeated-import checks; the removed database tests directory and its pytest/JUnit step are no longer used.
