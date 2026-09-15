# Trading Season

Trading simulation monorepo with an Angular interface, a Spring Boot backend, and a NestJS authentication service. Reporting applications are placeholders.

## Start here

Install Node.js 22.22.3+ (22.x), npm 11.16.0, JDK 21, Maven 3.9+, and Docker with Compose. From the repository root:

```sh
npm ci
npm --prefix apps/auth-service ci
npm --workspace business-logic-ui start
```

The UI opens on port 4200. Its forms currently perform local validation; API integration is unfinished. Follow [development setup](docs/guides/development.md) to start services and databases.

## Service map

| Area | Responsibility | Local port |
| --- | --- | --- |
| [Business UI](apps/business-logic-ui/README.md) | Login and registration screens | 4200 |
| [Business backend](apps/business-backend/README.md) | Java registration and session login | 8080 |
| [Auth service](apps/auth-service/README.md) | RS256 tokens, refresh tokens, auth database | 3001 |
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

Canonical relationship diagram for the business SQL schema after V001 and V002. SQL defines exact columns and constraints. See the [database reference](docs/reference/database.md) for ownership, initialization, and change rules.

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
