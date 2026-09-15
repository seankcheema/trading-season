# Database

## Two separate stores

The Java business backend and NestJS auth service have separate PostgreSQL databases and user models. Do not assume identities or sessions are shared.

| Store | Schema source | Application behavior |
| --- | --- | --- |
| Business: trading_season | [V001 bootstrap SQL](../../apps/business-backend/db/migrations/V001__Initial_schema.sql) plus incremental SQL such as [V002 synthetic market data replay metadata](../../apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql) | Hibernate ddl-auto=none; no Flyway dependency or automatic migration runner |
| Auth: auth_db | [TypeORM migrations](../../apps/auth-service/src/database/migrations/) | Migrations run on startup; synchronize=false |

The business bootstrap defines more of the trading model than the currently implemented Java auth API. The ERD below is the canonical diagram; SQL remains authoritative for exact columns and constraints.

## Business model

| Group | Tables and responsibility |
| --- | --- |
| Identity | users and sessions: profile, credentials, login sessions |
| Simulation/reference | simulation_sessions, stocks, instruments: reproducible runs and tradable assets |
| Market data | market_states, market_behaviors, quotes, market_ticks, candles: state, history, replay data |
| Accounts/execution | accounts, holdings, orders, fills: balances, positions, instructions and executions |
| Ledgers/audit | cash_transactions, holding_movements, audit_trail: accounting and event history |

Orders are distinct from fills. The schema allows at most one fill per order. The account/client_reference pair supplies order idempotency. Cash balances and holdings are caches reconciled against append-only ledgers. Application grants should limit ledger/audit access to the appropriate insert/read operations; table definitions alone do not enforce every operational policy.

Simulation data is scoped by run and stock. Deleting a simulation session cascades through its generated market data. The optional unique instruments.simulated_stock_symbol connects U.S. equity instruments to simulator stocks. V002 adds replay metadata and uniqueness needed by synthetic market data imports; it does not add trading APIs. Trading schema support for other asset classes does not imply their simulation or APIs are implemented.

## Disposable business database setup

Use this setup for a local development database whose contents can be discarded. `V001__Initial_schema.sql` drops and recreates tables, so it is not a safe upgrade path for retained data. `V002__Synthetic_market_data_replay_metadata.sql` is applied after V001.

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

Connect pgAdmin Query Tool to the `trading_season` database, then run these files in order:

1. `apps/business-backend/db/migrations/V001__Initial_schema.sql`
2. `apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql`

With `psql`, the equivalent commands from the repository root are:

```sh
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V001__Initial_schema.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql
```

### Verify the schema

Run this in `trading_season`:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see tables such as `users`, `sessions`, `stocks`, `simulation_sessions`, `quotes`, `market_ticks`, and `candles`.

### Optional synthetic market data generation and import

The generated `2026-v1` archive is stored locally in `apps/business-backend/db/seeds/synthetic-market-data-2026-v1` and is not committed to Git. A full archive contains 61,074,000 one-second ticks and 1,017,900 tick-derived one-minute candles.

Run the complete routine workflow from the repository root with one command. It creates the virtual environment if needed, installs dependencies, generates or reuses the archive, carries the completed validation forward to the importer, and displays progress while loading PostgreSQL:

```powershell
apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season
```

For a small archive, add `-StartDate 2026-01-05 -EndDate 2026-01-06`. Add `-Regenerate` to replace an incompatible archive or `-Replace` to replace a different import for the same session. On a brand-new disposable database, add `-InitializeDisposableDatabase`; this drops and recreates the business tables.

The individual commands below remain available for troubleshooting and non-Windows environments. Run them from the repository root.

#### Step 1: Install the Python dependencies

Create the virtual environment and install its dependencies once:

```powershell
py -3 -m venv apps/business-backend/db/.venv
apps/business-backend/db/.venv/Scripts/python.exe -m pip install --upgrade pip
apps/business-backend/db/.venv/Scripts/python.exe -m pip install -r apps/business-backend/db/scripts/requirements.txt
```

#### Step 2: Initialize a disposable database

Run this step only when setting up the business database for the first time. It applies V001 and V002, and V001 drops existing tables.

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

The importer validates the archive again and loads it in one transaction:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/0004-import-synthetic-market-data.py `
  --database-url postgresql://trading_season:password@localhost:5432/trading_season
```

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

For a full-year archive, `market_ticks` should contain 61,074,000 rows and `candles` should contain 1,017,900 rows. A date-range archive will have smaller totals.

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

For later routine seeding, run steps 3 through 6 only. The import adds stocks, simulation metadata, market behaviors, market states, ticks, and candles. It does not add users, accounts, orders, holdings, auth-service data, or quotes.

There is no Flyway runner in the Java backend; these files are applied manually.

## Auth migrations

[Runtime configuration](../../apps/auth-service/src/config/database.config.ts) and the [CLI data source](../../apps/auth-service/src/database/data-source.ts) must retain matching entity and migration lists. The initial schema creates auth users and refresh-token storage; the subsequent migration requires username.

From apps/auth-service, npm run migration:show and npm run migration:run inspect/apply migrations. Export the matching database environment variables before invoking the CLI: its data source does not itself load dotenv. Normal application startup loads .env and runs migrations automatically.

Refresh tokens are stored as hashes with expiry, revocation, and rotation metadata. See the [auth README](../../apps/auth-service/README.md) for connection and key setup.

## Change rules

Add incremental migrations rather than editing already applied files. For business changes, explicitly document the application procedure because no migration runner is installed. Review SQL, affected entity mappings, and the ERD together. Use test fixtures instead of production identities or secrets. Back up retained data and verify migrations on a disposable copy before deployment.

# Business database ERD

Canonical relationship diagram for the business SQL schema after V001 and V002. SQL defines exact columns and constraints. See this database reference for ownership, initialization, and change rules.

The optional instruments.simulated_stock_symbol links an instrument to a simulator stock. Market data belongs to a simulation session and stock. Keep this diagram synchronized when schema relationships change.

```mermaid
erDiagram
    users ||--o{ sessions : authenticates
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
        TEXT username UK
        TEXT email UK
        TEXT user_role
        TEXT account_status
    }
    sessions {
        UUID session_id PK
        UUID user_id FK
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ revoked_at
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
