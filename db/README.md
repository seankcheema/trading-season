# Database

One PostgreSQL database, `trading_season`, shared by the auth service and the two Java services. The schema is defined only by the migrations in [migrations](migrations), applied in file order; no service runs migrations itself and Hibernate never alters tables.

The Reporting Service does not connect to it. What reporting shows is published to Kafka by the service that owns each row; the [tools](#reporting-feed-tools) below publish what those services never saw being written.

| Migration | Purpose |
| --- | --- |
| [V001__Initialize_database.sql](migrations/V001__Initialize_database.sql) | The full schema for an empty database |
| [V002__Add_watchlist.sql](migrations/V002__Add_watchlist.sql) | `user_watchlist` |
| [V003__Order_status_accepted.sql](migrations/V003__Order_status_accepted.sql) | Allows `ACCEPTED` in `orders.status`: an order is committed as accepted before it executes, then becomes `FILLED` or `REJECTED` |
| [V008__Drop_account_status.sql](migrations/V008__Drop_account_status.sql) | Removes `user_accounts.account_status` |
| [V009__Add_account_archiving.sql](migrations/V009__Add_account_archiving.sql) | Adds account archiving (`accounts.archived_at`) so portfolios are retired without deleting history |
| [V009__Add_terms_acceptances.sql](migrations/V009__Add_terms_acceptances.sql) | Adds `terms_acceptances`: one row per user and terms version |
| [V009__Analyst_role.sql](migrations/V009__Analyst_role.sql) | Allows `ANALYST` in `user_accounts.user_role` |
| [V010__Enforce_execution_buffers.sql](migrations/V010__Enforce_execution_buffers.sql) | Adds execution buffer defaults and replay-execution context used by order execution |

The repository currently contains multiple `V009__*.sql` files. The migration runner tracks applied filenames in `public.schema_migrations`, so each file is applied once. Do not rename or edit applied migrations; add a new migration for further schema changes.

In Docker, `db-init` runs [infrastructure/docker/init-db.sh](../infrastructure/docker/init-db.sh), which applies each file once and records it in `public.schema_migrations`. For a local PostgreSQL, apply the files in order with `psql -v ON_ERROR_STOP=1 -f`. Never edit an applied migration; add a new one.

## Reporting feed tools

[tools](tools) holds two command line tools and their tests. They are the only code that reads the database on reporting's behalf, they run when an operator runs them, and no service installs or imports them.

```sh
python -m venv db/tools/.venv
db/tools/.venv/bin/python -m pip install -r db/tools/requirements.txt     # Windows: db/tools/.venv/Scripts/python
```

| Tool | What it does | Writes to |
| --- | --- | --- |
| [republish_history.py](tools/republish_history.py) | Reads the database once, in a single read-only snapshot, and publishes it to `trade-events` and `platform-records` in the shape the services publish it | Kafka only |
| [seed_demo_history.py](tools/seed_demo_history.py) | Development only. Creates eight demo traders and writes six months of their trading up to the present moment | The database only |

### Republishing history

```sh
db/tools/.venv/bin/python db/tools/republish_history.py \
    --database-url postgresql://trading_season:password@localhost:5432/trading_season \
    --bootstrap-servers localhost:29092
```

The services publish a row when they commit it. Rows that predate those publishers, or that SQL wrote (a seed, a restore, [demo-trader.sql](../apps/market-data/db/seeds/demo-trader.sql)), are in neither topic, so reporting does not know them. Run this once when adopting the Kafka-only reporting service, and again after loading rows with SQL.

- It publishes every sign-in, profile, account, deposit and withdrawal, the newest valuation of each account, every audit entry, the newest completed simulation session, and every order at its current status with its fill and ledger postings. [reporting_feed.py](tools/reporting_feed.py) builds each message to mirror what the owning service sends, with the same key, so a row's history and its future land on the same partition.
- The balance a posting left is not stored per row. It is worked back from today's: a trader's cash by removing every later posting of theirs, a holding by removing every later movement of that account and instrument.
- It is safe to run again. Reporting applies each message as an upsert keyed by the row, and its report runs count an order's status once however often it arrives.
- Republished order events carry a `replay` header. The `order-status-pusher` and `portfolio-valuation-capture` consumers skip them, so an old order is not pushed to a browser or valued again; the reporting consumer stores them like any other.
- `--dry-run` prints how many messages of each kind it would publish and needs no broker. `--trade-events-topic` and `--platform-records-topic` name the topics for a deployment that renamed them.
- It never selects a password hash, SSN, address or date of birth.

### Demo history

```sh
db/tools/.venv/bin/python db/tools/seed_demo_history.py \
    --database-url postgresql://trading_season:password@localhost:5432/trading_season
```

Additive, and for a development database only: nothing that exists is changed or removed. It needs tradable instruments, which the [market data import](../apps/market-data/README.md) creates.

- Eight traders across the three levels, who joined between six months and one month ago, and one sign-up that never completed a profile. Their sign-ins end in `@demo.tradingseason.example` and the password is `DemoTrader1!`, so any of them can sign in to the Client UI. One is locked out for a week, so the reporting console has a lock to show.
- Orders that filled and orders the trading rules rejected, with the reasons the Order and Sell Service gives, on weekdays; deposits and withdrawals; and the fills, cash and holding ledgers, holdings, audit trail and portfolio valuations that go with them. Cash never goes below zero and nothing is sold that is not held.
- Prices follow a seeded random walk from each instrument's starting price. They are plausible and repeatable, and they are not the simulated market's prices.
- The same trader on the same day always does the same things. Run again later, it adds only the days since it last ran; run twice on one day, the second run adds nothing.
- `--days` sets how far back the history starts on a first run (default 180).
- `--dry-run` writes everything, prints the summary and rolls it all back. It still advances the id sequences.
- It publishes nothing. Run `republish_history.py` afterwards for reporting to see the history.

Tests: `python -m pytest tests` in `db/tools`. They need no database or broker.

## Schema
```mermaid
erDiagram
    user_accounts ||--|| users : "credentials for"
    user_accounts ||--o{ refresh_tokens : issues
    users ||--o{ accounts : owns
    users ||--o{ user_watchlist : saves
    users ||--o{ terms_acceptances : accepts
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
    terms_acceptances {
        UUID user_id PK, FK
        TEXT terms_version PK
        TIMESTAMPTZ accepted_at
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

## Execution buffer migration

Apply [V010](migrations/V010__Enforce_execution_buffers.sql) after V009 before starting the updated services. It changes `users.execution_buffer_percent`'s default to 1 and backfills existing zero values to 1; nonzero values remain unchanged. Users may select zero again after migration. API validation restricts new settings and overrides to 0-10 percent with two decimal places. Legacy out-of-range settings must be corrected before use; the migration deliberately preserves them.

Orders gain nullable `session_id` and `executed_simulated_at`. The session records replay context without a foreign key so unavailable requested sessions can still leave a rejected order. The execution timestamp comes from the server quote; `simulated_at` remains client context and existing audit timestamps remain real server times. Actual execution prices stay canonical in `fills.quote_price`; historical rows require no backfill.
