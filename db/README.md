# Database

One PostgreSQL database, `trading_season`, shared by the auth service and the two Java services. The schema is defined only by the migrations in [migrations](migrations), applied in file order; no service runs migrations itself and Hibernate never alters tables.

The Reporting Service does not connect to it. What reporting shows is published to Kafka by the service that owns each row; the [tools](#reporting-feed-tools) below publish what those services never saw being written.

| Migration | Purpose |
| --- | --- |
| [V001__Initialize_database.sql](migrations/V001__Initialize_database.sql) | The full schema for an empty database |
| [V002__Add_watchlist.sql](migrations/V002__Add_watchlist.sql) | `user_watchlist` |
| [V003__Order_status_accepted.sql](migrations/V003__Order_status_accepted.sql) | Allows `ACCEPTED` in `orders.status`: an order is committed as accepted before it executes, then becomes `FILLED` or `REJECTED` |
| [V008__Drop_account_status.sql](migrations/V008__Drop_account_status.sql) | Removes `user_accounts.account_status` |
| [V009__Add_terms_acceptances.sql](migrations/V009__Add_terms_acceptances.sql) | `terms_acceptances`: one row per client and version of the platform terms they accepted |
| [V009__Analyst_role.sql](migrations/V009__Analyst_role.sql) | Allows `ANALYST` in `user_accounts.user_role`, the role the Reporting Service serves its report runs to; `ADMIN`, allowed since V001, is served the console as well |
| [V010__Portfolio_account_lifecycle.sql](migrations/V010__Portfolio_account_lifecycle.sql) | Account archival status and timestamp, retaining financial history |
| [V011__Execution_preferences_and_order_types.sql](migrations/V011__Execution_preferences_and_order_types.sql) | Saved execution buffers, conditional orders, immutable quote context and reservations |
| [V012__Stop_trigger_reference.sql](migrations/V012__Stop_trigger_reference.sql) | Latched stop activation quote |
| [V013__Order_audit_lifecycle.sql](migrations/V013__Order_audit_lifecycle.sql) | Conditional-order, cancellation and expiry audit events |
| [V015__Cash_transaction_client_reference.sql](migrations/V015__Cash_transaction_client_reference.sql) | `cash_transactions.client_reference`, unique when present: the key a client sends with a deposit or withdrawal so a retry posts once (BR-10, section 9.1). Order fills and older rows keep it null |
| [V016__Protect_trade_records.sql](migrations/V016__Protect_trade_records.sql) | Triggers that make the [trade record](#trade-record) append-only (BR-14, section 9.4) |
| [V017__Protect_client_identity.sql](migrations/V017__Protect_client_identity.sql) | Triggers that fix the identity of the client the trade record is attributed to, and make `terms_acceptances` append-only |

In Docker, `db-init` runs [infrastructure/docker/init-db.sh](../infrastructure/docker/init-db.sh), which applies each file once and records it in `public.schema_migrations`. For local PostgreSQL on Windows, use [migrate-local.ps1](../scripts/migrate-local.ps1), which uses the same filename ledger, applies pending migrations transactionally, and serializes concurrent runs. See [Windows migration setup](../docs/local-setup/windows.md#3-migrate-and-seed-the-database) for new databases and explicit baselining of existing databases without a ledger. Never edit an applied migration; add a new one.

The Windows runner's integration checks use a new temporary PostgreSQL cluster,
never the application database. With PostgreSQL binaries on `PATH`, run:

```powershell
.\scripts\tests\test-migrate-local.ps1
```

The checks cover fresh setup, repeated runs, both V009 filenames, explicit legacy
baselining, failure rollback, resuming an upgrade, and preserving existing data.
The test stops its cluster and prints the retained diagnostic directory.

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

Tests: `python -m pytest tests` in `db/tools`. They need no database or broker. Add `--cov=. --cov-report=term-missing --cov-report=html:coverage/htmlcov --cov-report=xml:coverage/coverage.xml` for coverage (`.coveragerc` leaves the tests themselves out of the measurement); Jenkins archives the reports from `db/tools/coverage`.

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
        UUID client_reference UK
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

## Trade record

BR-14: every accepted order, pricing decision, and resulting change to cash or holdings must be permanently recorded and attributable to a specific client and time. The requirement sets no retention period, so nothing is archived out or purged, and closing an account or a client must leave every row in place.

| Table | What it records | Attributed by |
| --- | --- | --- |
| orders | The terms the client submitted, the quote context the server captured (`reference_price`, `reference_at`, `session_id`, execution type and prices) and the order's outcome, including `trigger_price` and `execution_price` | account, submission time |
| audit_trail | One row per lifecycle event, with a self-contained description; see [Order and Sell: audit trail](../apps/order-and-sell-service/README.md#audit-trail) | order, recording time |
| fills | The quantity and price an order was filled at | order, fill time |
| cash_transactions | The signed cash change from a fill, deposit, or withdrawal | account, creation time |
| holding_movements | The signed share change from a fill | account, instrument, creation time |

An account always belongs to one user, so every row resolves to a client through its account.

V016 and V017 add triggers that enforce this for every role, including the table owner the services connect as:

| Table | Allowed | Rejected | Migration |
| --- | --- | --- | --- |
| audit_trail, fills, cash_transactions, holding_movements | INSERT | UPDATE, DELETE, TRUNCATE | V016 |
| orders | INSERT; a `PENDING` order may become `ACCEPTED`; while open its working columns (evaluation and trigger times, trigger price, reservations, retry state, attempt count) may change; it is resolved once to `FILLED`, `REJECTED` or `CANCELLED`; a `CANCELLED` order may still receive its rejection code and reason, which a replacement writes once the replacing order is known | Changing submitted terms, the captured quote context or a recorded acceptance time; changing a `FILLED` or `REJECTED` order; DELETE, TRUNCATE | V016 |
| accounts | INSERT, rename, archive | Moving an account to another user, DELETE, TRUNCATE | V016 |
| users | INSERT; changing address, trader level, the execution buffer and other settings, and the cached balance | Changing the user id, name, SSN, or date of birth; DELETE, TRUNCATE | V017 |
| user_accounts | INSERT; changing the password hash, role, and sign-in lockout state | Changing the user id or email, DELETE, TRUNCATE | V017 |
| terms_acceptances | INSERT | UPDATE, DELETE, TRUNCATE | V017 |

- A rejected change raises SQLSTATE `23001` (`restrict_violation`).
- `users.available_funds` and `holdings` stay mutable: they are cached balances derived from the ledgers, which remain the record.
- No service changes a frozen identity column; each is written once, at registration. There is no way to deactivate or delete a client, and none can be added as a row delete. A change-of-name or change-of-email feature needs a migration that records the history instead of overwriting it.
- Neither migration adds tables or columns or changes existing rows, and both may be reapplied. V016 must follow V011, whose backfill of `execution_price` it would otherwise reject; V017 reuses a function V016 creates, so apply them in order.
- Once they are applied, manual cleanup of these tables with `DELETE`, `UPDATE`, or `TRUNCATE` fails; reset a disposable database by recreating it.
- PostgreSQL makes committed rows durable across restarts, and a fill with its ledger rows is one transaction, so a crash or failed deployment leaves either the whole fill or none of it.

Limits:

- The table owner can remove the triggers with a schema change (`DROP TRIGGER`, or `ALTER TABLE ... DISABLE TRIGGER`), and the services connect as that owner. In the Compose stack they connect as the PostgreSQL superuser, which can also switch triggers off for its own session. Separating the owner role from the application role would close both paths; that separation is not implemented.
- Dropping a table or the database is not prevented. The only protection is a backup taken beforehand; see [Database backup and restore](../infrastructure/README.md#database-backup-and-restore). Backups are manual.
- The Java service tests run on H2, which does not load these triggers. With PostgreSQL binaries on PATH, [test_trade_record_migration.py](../apps/market-data/db/scripts/python/tests/test_trade_record_migration.py) verifies them against an isolated temporary cluster, including an open order being evaluated, cancelled and replaced, and reapplying both migrations to a database that already holds rows.

## Portfolio account lifecycle

[V010__Portfolio_account_lifecycle.sql](migrations/V010__Portfolio_account_lifecycle.sql) adds `accounts.status` (ACTIVE or ARCHIVED) and `archived_at`. A check constraint requires an archive timestamp exactly when status is ARCHIVED. Existing accounts become ACTIVE.

The client's Delete action archives; it never deletes rows or cascades financial history. Account identities and every ledger relationship remain intact. Holdings and Trade publishes `status` and `archivedAt` in TRADING_ACCOUNT records after commit, and [reporting_feed.py](tools/reporting_feed.py) republishes the same fields for existing rows. Reporting retains the lifecycle state without connecting to the trading database. Apply migrations before running the republisher against the new schema. The [lifecycle API](../apps/holdings-and-trade-service/api.md) documents eligibility and the shared cash behavior.

## Execution preferences and order reservations

[V011](migrations/V011__Execution_preferences_and_order_types.sql) changes the profile buffer default to 1%, replaces existing zero defaults with 1%, and enforces 0-10%. It aborts if an existing preference lies outside that range; correct those values before rerunning the migration.

Orders gain execution type and conditional prices, immutable reference quote/session/preference context, trigger and evaluation positions, reservations, execution price, rejection code and retry bookkeeping. Historical orders default to MARKET with unknown reference context left null; fills supply historical execution prices. Legacy ACCEPTED orders without context are not evaluated automatically. CANCELLED joins the status constraint. The existing unique fill-per-order constraint prevents duplicate execution. Apply migrations before deploying either Java service. See the [Order API](../apps/order-and-sell-service/api.md) for lifecycle and locking behavior.

The migration contract test in `db/tools/tests/test_execution_migration.py` runs only with `EXECUTION_MIGRATION_DISPOSABLE_DATABASE_URL` set to an explicitly disposable PostgreSQL database. It creates an isolated temporary schema and verifies atomic rejection of invalid historical preferences, defaults, preservation of nonzero values, and historical order backfill.

[V012](migrations/V012__Stop_trigger_reference.sql) adds the latched Stop activation quote. Submission quote columns remain unchanged for auditing; untriggered historical orders capture the activation quote when they trigger.

[V013](migrations/V013__Order_audit_lifecycle.sql) permits TRIGGERED and CANCELLED audit entries. This fixes PostgreSQL rollbacks on Stop triggering, manual cancellation, and day-order expiry.

## Dua viewed insights

[V018](migrations/V018__Dua_read_state.sql) adds `dua_read_state`, owned by Holdings and Trade. Rows acknowledge an exact user/account/simulation/category/stock/content version; an SHA-256 identity makes duplicate acknowledgments idempotent. Old versions remain available for simulation rewinds and concurrent devices. This is a UI preference with no reporting-feed contract. Deploy the migration before enabling the new [Dua API](../apps/holdings-and-trade-service/api.md#dua-read-state).
