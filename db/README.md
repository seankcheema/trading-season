# Database

The services share the PostgreSQL `trading_season` database on port 5432. The canonical schema is maintained in [migrations](migrations); services do not apply migrations themselves. Run the commands below from the repository root.

## Local PostgreSQL setup

Install PostgreSQL 16 and make `psql` available on `PATH`. Connect to the default `postgres` database as your PostgreSQL administrator, using psql or pgAdmin's Query Tool. Create the development role and database, running each statement separately (database creation cannot run inside a transaction):

```sql
CREATE ROLE trading_season WITH LOGIN PASSWORD 'password';
```

```sql
CREATE DATABASE trading_season OWNER trading_season;
```

These commands assume the role and database do not already exist. The password is a local development example; use the same value in each service's configuration.

### Apply migrations

Connect as the database owner and apply the checked-in migrations in version order. For a fresh database, the `public` schema must be empty before V001:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V001__Initialize_database.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V002__Add_watchlist.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V008__Drop_account_status.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V009__Add_account_archiving.sql
```

Stop if any command fails. The repository currently contains V001, V002, V008, and V009; there are no separate V003-V007 files. V001 initializes the schema, V002 adds the saved watchlist, V008 removes `user_accounts.account_status` and its values, and V009 adds portfolio account archiving. After all four, a fresh database has 20 application tables.

### Upgrade a legacy database

V001 also repairs a legacy schema missing all three of `user_accounts`, `refresh_tokens`, and `portfolio_valuations`, preserving existing application data. Run it as the database owner, then apply V002, V008, and V009 using the commands above. A legacy database retaining the `sessions` table has 21 application tables after repair.

V001 refuses to run if any of those three tables already exists; do not rerun it on an initialized or partially upgraded database. For a database where V001 is already applied, apply only the remaining migrations. The SQL is the authority for supported repair behavior: see [V001](migrations/V001__Initialize_database.sql).

### Verify ownership and permissions

Connect to `trading_season` and check table ownership:

```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Application tables should be owned by `trading_season`. If they were created as another user, connect to this database as the administrator and correct ownership and permissions:

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO trading_season', r.tablename);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO trading_season;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_season;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_season;
```

Run the ownership query again to verify the result. Future migrations should also run as `trading_season`. If another role will create future objects, run these grants as that creating role (default privileges apply only to objects it creates):

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trading_season;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO trading_season;
```

## Docker Compose setup

To run the database in Docker while running applications locally:

```powershell
$env:DB_PASSWORD = 'password'
docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml up -d db db-init
docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml logs db-init
```

Check that `db-init` finishes successfully before starting applications. PostgreSQL is available at `localhost:5432`, with database and user `trading_season`. Setting `DB_PASSWORD` above aligns it with the local configuration example; Compose defaults to `changeme` when it is unset. Ensure port 5432 is available.

The [migration runner](../infrastructure/docker/init-db.sh) waits for PostgreSQL, applies each migration once, and records filenames in `public.schema_migrations`. That ledger is an additional table beyond the 20 application tables. Starting only `db` does not apply migrations. The named database volume persists across restarts; changing `DB_PASSWORD` does not change the password of a role already stored in that volume.

## Connect applications and verify setup

Copy [the auth environment example](../apps/auth-service/.env.example) if you have not configured it yet:

```powershell
Copy-Item apps/auth-service/.env.example apps/auth-service/.env
```

Set `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=trading_season`, `DB_USER=trading_season`, and `DB_PASSWORD` to the chosen database password in `apps/auth-service/.env`. For the Java services, set the matching password before starting local processes:

```powershell
$env:SPRING_DATASOURCE_PASSWORD = 'password'
```

Both Java services default to `jdbc:postgresql://localhost:5432/trading_season` and user `trading_season`. See the [root getting-started instructions](../README.md#getting-started) for dependencies, JWT key generation, and application startup.

After startup, verify that the auth table is accessible:

```sql
SELECT user_id, email, user_role, created_at
FROM user_accounts
ORDER BY created_at DESC;
```

The query lists registered users, if any; an empty result before registration or development seeding is valid.

## Synthetic market data

With the schema migrated, generate and load synthetic data using the routine from the pasted setup:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/market-data/db/scripts/powershell/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

Use the configured password in the URL and report free space on the drive storing PostgreSQL data. Add `-StartDate 2026-01-05 -EndDate 2026-01-06` for a smaller archive, or `-Regenerate` to replace an incompatible archive. The launcher creates a Python virtual environment, installs dependencies, generates the 2026 archive, validates it, and imports candles and session metadata. Raw ticks remain in Parquet; retain the archive for replay.

The separate `setup-database.ps1` initializer applies only V001 and V002 to an empty schema; apply V008 and V009 afterwards. For pipeline details and individual troubleshooting commands, see the [Market Data README](../apps/market-data/README.md).

## Schema

The diagram describes the 20 application tables after all checked-in migrations. SQL defines the full columns and constraints. Add new migrations for schema changes; do not edit applied migrations.

```mermaid
erDiagram
    user_accounts ||--|| users : "credentials for"
    user_accounts ||--o{ refresh_tokens : issues
    users ||--o{ accounts : owns
    users ||--o{ user_watchlist : saves
    stocks ||--o{ user_watchlist : appears_in

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
        INTEGER failed_login_attempts
        TIMESTAMPTZ locked_until
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    user_watchlist {
        UUID user_id PK, FK
        VARCHAR symbol PK, FK
        TIMESTAMPTZ created_at
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

## Portfolio account archiving

Apply `db/migrations/V009__Add_account_archiving.sql` after V008 before starting updated Java services. It adds nullable `accounts.archived_at`; existing accounts remain active. Archiving updates only this timestamp. Account IDs, names, foreign keys, and all related transaction and valuation rows are retained for reporting and future auditing. No name uniqueness constraint prevents reusing an archived name.
