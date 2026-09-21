# Trading Season

Trading simulation monorepo with an Angular interface, two Spring Boot microservices, and a NestJS authentication service. Reporting applications are placeholders.

The Java backend is split into two independent microservices:
- **Holdings and Trade Service** (`apps/holdings-and-trade-service/`) - Manages orders, validation, and holdings
- **Order and Sell Service** (`apps/order-and-sell-service/`) - Provides user data, holdings queries, and order history

Both services share a single PostgreSQL database and authentication via the NestJS auth service.

## Start locally on Windows

Install Node.js 22.22.3+ (22.x), npm 11.16.0, JDK 21, Maven 3.9+, and PostgreSQL. The business database defaults to `127.0.0.1:5432`. The auth example uses `127.0.0.1:5433`, matching the host port published by Docker Compose, but the local launcher honors the valid localhost `DB_PORT` configured in the auth `.env`.

1. Create the `trading_season`/`trading_season` and `auth_db`/`authuser` database/user pairs. Apply business migrations V001, V002, and V003 in order. Follow the [database setup](docs/reference/database.md#disposable-business-database-setup) for the SQL and migration commands.
2. Install dependencies from the repository root:

   ```powershell
   npm ci
   npm --prefix apps/auth-service ci
   ```

3. Configure authentication:

   ```powershell
   Copy-Item apps/auth-service/.env.example apps/auth-service/.env
   ```

   In the copied `.env`, remove the placeholder `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, and `JWT_ISSUER` lines before generating the real development values. Keep the example's `DB_PORT=5433` when using the Compose auth database. If `auth_db` is instead on the same local PostgreSQL instance as the business database, set `DB_PORT=5432`. Set the password assigned to `authuser`, then run:

   ```powershell
   Push-Location apps/auth-service
   node scripts/generate-dev-keys.mjs >> .env
   Pop-Location
   ```

   To check registered users, connect pgAdmin's Query Tool to `auth_db` and run this query. It intentionally excludes password hashes:

   ```sql
   SELECT id, email, role, is_active, failed_attempts, locked_until, created_at
   FROM users
   ORDER BY created_at DESC;
   ```

4. Start the full stack. Set `SPRING_DATASOURCE_PASSWORD` first to avoid the secure prompt when the business database does not use the application default:

   ```powershell
   $env:SPRING_DATASOURCE_PASSWORD = 'password'
   .\scripts\start-local.ps1
   ```

The launcher keeps all logs in one terminal and stops the other services if one exits. Open the UI at `http://localhost:4200`; auth runs on `http://localhost:3001`, Holdings and Trade Service on `http://localhost:8081`, and Order and Sell Service on `http://localhost:8082`. See the [development guide](docs/guides/development.md) for Docker, tests, and individual service commands.

## Service map

| Area | Responsibility | Local port |
| --- | --- | --- |
| [Business UI](apps/business-logic-ui/README.md) | Login, registration, and a dashboard with live simulated stock tickers | 4200 |
| [Holdings and Trade Service](apps/holdings-and-trade-service/README.md) | Order creation, validation, execution, and holdings management | 8081 |
| [Order and Sell Service](apps/order-and-sell-service/README.md) | User profiles, holdings queries, and order history | 8082 |
| [Auth service](apps/auth-service/README.md) | RS256 tokens, refresh tokens, auth database | 3001 |
| [Business Database](apps/business-backend/README.md) | Shared PostgreSQL database setup and migrations | — |
| [Shared UI](packages/shared-ui-components/README.md) | Reusable Angular components | — |
| [Reporting proposal](docs/reference/reporting.md) | Future analytics UI and service | — |
| [Infrastructure](infrastructure/README.md) | Compose and Jenkins configuration | — |

## Documentation

Browse the [documentation index](docs/README.md) to choose a guide or reference.

- [Development](docs/guides/development.md): setup, commands, tests, contribution workflow.
- [Architecture](docs/reference/architecture.md): boundaries, source navigation, current limitations.
- [API reference](docs/reference/api.md): implemented HTTP contracts.
- [Database](docs/reference/database.md): schema ownership, migrations, and ERD.
- [Operations](docs/guides/operations.md): configuration, CI, deployment limitations, troubleshooting.
- [Agent instructions](AGENTS.md): repository rules and completion checks.

[Javadocs](docs/JAVA_DOCS/index.html) are kept in the repository and generated from Java source; the generation and update requirements are in the development guide.

# Business database ERD

Canonical relationship diagram for the business SQL schema after V001, V002 and V003. SQL defines exact columns and constraints. See the [database reference](docs/reference/database.md) for ownership, initialization, and change rules.

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
