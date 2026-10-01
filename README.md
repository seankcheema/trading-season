# Trading Season

Trading simulation monorepo with an Angular interface, two Spring Boot microservices, and a NestJS authentication service. Reporting applications are placeholders.

The backend consists of two independent Java microservices and one NestJS authentication service:
- **Order and Sell Service** (`apps/order-and-sell-service/`) – Order submission, validation, execution, and instrument reference data
- **Holdings and Trade Service** (`apps/holdings-and-trade-service/`) – User profiles, accounts, holdings, cash movements, and market data
- **Auth Service** (`apps/auth-service/`) – Email/password authentication, RS256 token issuance, refresh token rotation

All services share a single PostgreSQL database (`trading_season`).

## Start locally on Windows

Install Node.js 24.8.0+ (24.x), npm 11.16.0, JDK 21, Maven 3.9+, and PostgreSQL (or Docker Compose).

### Quick start with the startup script (requires local databases)

1. Install dependencies from the repository root:

   ```powershell
   npm ci
   npm --prefix apps/auth-service ci
   ```

2. Configure authentication:

   ```powershell
   Copy-Item apps/auth-service/.env.example apps/auth-service/.env
   cd apps/auth-service
   node scripts/generate-dev-keys.mjs | Add-Content .env
   cd ../..
   ```

3. Ensure the database is running (`trading_season` on port 5432).

4. Start all services with the startup script:

   ```powershell
   $env:SPRING_DATASOURCE_PASSWORD = 'password'
   .\scripts\start-local.ps1
   ```

   The launcher consolidates all logs in one terminal and stops all services if any one exits. Open the UI at `http://localhost:4200`. Auth runs on `http://localhost:3001`, Order and Sell Service on `http://localhost:8081`, and Holdings and Trade Service on `http://localhost:8082`. Each service's port comes from its own `application.properties`. See the [development guide](docs/guides/development.md) for Docker, tests, and individual service commands.

### Manual setup with local PostgreSQL

If you prefer to run PostgreSQL locally:

#### 1. Create business database

Connect to the default `postgres` database as your PostgreSQL admin user. In pgAdmin Query Tool or psql, run:

```sql
CREATE ROLE trading_season WITH LOGIN PASSWORD 'password';
```

```sql
CREATE DATABASE trading_season OWNER trading_season;
```

Then apply the schema. Connect to `trading_season` as the `trading_season` user and run these migration files in order:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V001__Initial_schema.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V002__Synthetic_market_data_replay_metadata.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V003__Token_authentication.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V004__Order_status_lifecycle.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V005__User_accounts_and_refresh_tokens.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V006__Drop_duplicated_account_columns.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V007__Add_account_name.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V008__Backfill_instruments_from_stocks.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/market-data/db/migrations/V009__Portfolio_valuations.sql
```

Verify that `trading_season` owns the tables. Connect to the `trading_season` database and run:

```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

If another user (such as `postgres`) owns the tables, connect to the `trading_season` database as the admin user and reassign ownership and permissions:

```sql
-- Reassign all table ownership to trading_season user
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO trading_season', r.tablename);
  END LOOP;
END $$;

-- Grant permissions to trading_season user
GRANT USAGE ON SCHEMA public TO trading_season;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_season;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_season;

-- Ensure future tables get the same permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trading_season;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trading_season;

-- Verify: all tables should now be owned by trading_season
SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

#### 2. Configure auth service

Copy and configure the auth `.env`:

```powershell
Copy-Item apps/auth-service/.env.example apps/auth-service/.env
```

Set `DB_PORT=5432` (since auth is on the same PostgreSQL instance), then generate the JWT keys:

```powershell
cd apps/auth-service
node scripts/generate-dev-keys.mjs | Add-Content .env
cd ../..
```

#### 3. Start applications

Use the startup script as above, or start each application in its own terminal:

```powershell
npm ci
npm --prefix apps/auth-service ci

# Terminal 1: UI from repository root
npm --workspace business-logic-ui start

# Terminal 2: Holdings and Trade Service
cd apps/holdings-and-trade-service
mvn spring-boot:run

# Terminal 3: Order and Sell Service
cd apps/order-and-sell-service
mvn spring-boot:run

# Terminal 4: Auth service (migrations run on startup)
cd apps/auth-service
npm run start:dev
```

### Docker Compose setup (alternative)

If you prefer to use Docker Compose for databases:

1. Install dependencies and configure authentication (steps 1-2 above).

2. Start the database:

   ```powershell
   docker compose -f infrastructure/docker-compose/docker-compose.local.yml up -d db
   ```

   This creates the `trading_season` database on `localhost:5432` with all required migrations applied.

3. Start all services with the startup script:

   ```powershell
   $env:SPRING_DATASOURCE_PASSWORD = 'password'
   .\scripts\start-local.ps1
   ```

### Verify database setup

After startup, verify that the auth tables exist in `trading_season`. Connect pgAdmin's Query Tool (or psql) to `trading_season` and run:

```sql
-- Verify user_accounts table exists and check registered users
SELECT user_id, email, user_role, account_status, created_at
FROM user_accounts
ORDER BY created_at DESC;
```

You should see registered users listed here (if any).

### Generate and seed synthetic market data

Synthetic market data is required for the trading simulation. Run the complete routine from the repository root to generate and load mock data:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/market-data/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

For a smaller test archive (e.g., 2 days of data), add `-StartDate 2026-01-05 -EndDate 2026-01-06`.

For a fresh database, add `-InitializeDisposableDatabase` to drop and recreate business tables. Add `-Regenerate` to replace an incompatible archive.

**On first run**, this script will:
1. Create a Python virtual environment at `apps/market-data/db/.venv`
2. Install dependencies from `apps/market-data/db/scripts/requirements.txt`
3. Generate synthetic market data for the year 2026
4. Validate the generated archive
5. Import into PostgreSQL (raw ticks stay in Parquet; candles load to the database)

If needed, you can run individual steps for troubleshooting. See the [database guide](docs/reference/database.md#optional-synthetic-market-data-generation-and-import) for step-by-step commands.

See the [development guide](docs/guides/development.md) for additional commands, tests, and troubleshooting.

## Service map

| Service | Folder | Port | Responsibility |
| --- | --- | --- | --- |
| Client UI | `apps/client-ui` | 4200 | Login, registration, dashboard with live market data |
| Auth Service | `apps/auth-service` | 3001 | Email/password authentication, RS256 token issuance, refresh token rotation |
| Order and Sell Service | `apps/order-and-sell-service` | 8081 | Order submission, validation and execution; order history; instrument reference data |
| Holdings and Trade Service | `apps/holdings-and-trade-service` | 8082 | User profiles, accounts, holdings, cash movements, market data |
| Market Data | `apps/market-data` | — | Shared database migrations and synthetic market data tooling |
| Shared UI Components | `packages/shared-ui-components` | — | Reusable Angular components library |
| Reporting | `docs/reference/reporting.md` | — | Proposed analytics and portfolio performance reporting |

## Documentation

Review the [documentation index](docs/README.md) for all guides and references. Key resources:

| When you need to… | Read |
| --- | --- |
| Install, run, test, or debug locally | [Development Guide](docs/guides/development.md) |
| Understand service architecture and boundaries | [Architecture Reference](docs/reference/architecture.md) |
| Review implemented API endpoints | [API Reference](docs/reference/api.md) |
| Understand database schema and ownership | [Database Reference](docs/reference/database.md) |
| Configure services and CI/CD | [Operations Guide](docs/guides/operations.md) |
| Plan analytics and reporting work | [Reporting Proposal](docs/reference/reporting.md) |
| Browse Java API documentation | [Javadocs](docs/JAVA_DOCS/index.html) |
| Review code coverage | [Coverage Reports](docs/coverage/README.md) |

[Javadocs](docs/JAVA_DOCS/index.html) are maintained in the repository and regenerated from Java source. See the [development guide](docs/guides/development.md) for regeneration procedures.

# Business database ERD

Canonical relationship diagram for the business SQL schema after V001 through V008. SQL defines exact columns and constraints. See the [database reference](docs/reference/database.md) for ownership, initialization, and change rules.

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
