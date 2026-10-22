# Trading Season

A trading simulation platform: an Angular client, two Spring Boot services for trading and holdings, and a NestJS authentication service, sharing one PostgreSQL database, and a Flask reporting service with its own Angular UI that has no connection to that database. Two Kafka topics feed it: `trade-events` carries every order status change from the Order and Sell Service to three consumers, and `platform-records` carries the current state of everything else reporting shows, from the service that owns each row.

## Services

| Service | Folder | Port | Responsibility |
| --- | --- | --- | --- |
| Client UI | [apps/client-ui](apps/client-ui/README.md) | 4200 | Landing, login, registration, trading dashboard |
| Auth Service | [apps/auth-service](apps/auth-service/README.md) | 3001 | Credentials, RS256 access tokens, refresh token rotation |
| Order and Sell Service | [apps/order-and-sell-service](apps/order-and-sell-service/README.md) | 8081 | Order submission, validation, execution, instruments |
| Holdings and Trade Service | [apps/holdings-and-trade-service](apps/holdings-and-trade-service/README.md) | 8082 | Profiles, accounts, holdings, cash, watchlist, market data |
| Reporting Service | [apps/reporting-service](apps/reporting-service/README.md) | 8083 | Kafka consumer (in the same container) storing both topics as files, scheduled report runs with charts, endpoints serving the runs to analysts and admins, and views of activity, orders and customers for admins from a read model of those files. No database connection |
| Reporting UI | [apps/reporting-ui](apps/reporting-ui/README.md) | 4300 | Sign-in for analysts and admins; report runs for both, and activity, customers and orders for admins, read from the Reporting Service |
| Market Data | [apps/market-data](apps/market-data/README.md) | - | Synthetic market data generation and import |
| Database | [db](db/README.md) | 5432 | Migrations and schema for the shared `trading_season` database, and the tools that publish its history to Kafka and seed demo history |

Java code that both Spring Boot services need is held once in [packages/trading-java-common](packages/trading-java-common/README.md) and compiled into each.

## Architecture

```mermaid
flowchart LR
    Trader([Trader]) --> UI["Client UI<br/>Angular :4200"]
    UI -- "login, register, refresh" --> Auth["Auth Service<br/>NestJS :3001"]
    UI -- "/api/orders, /api/instruments" --> OS["Order and Sell Service<br/>Spring Boot :8081"]
    UI -- "all other /api/*" --> HT["Holdings and Trade Service<br/>Spring Boot :8082"]

    OS -- "authoritative replay quotes" --> HT
    OS -. "cached JWKS" .-> Auth
    HT -. "cached JWKS" .-> Auth
    RS["Reporting Service :8083<br/>Flask API + Kafka consumer<br/>(one container, serve.py)"] -. "cached JWKS" .-> Auth

    Auth --> DB[("PostgreSQL<br/>trading_season :5432")]
    OS --> DB
    HT --> DB

    OS -- "one message per<br/>order status change" --> Kafka[["Kafka :29092<br/>topic trade-events"]]
    Kafka -- "group order-status-pusher" --> OS
    Kafka -- "group portfolio-valuation-capture" --> HT
    Kafka -- "group reporting-ingester" --> RS

    OS -- "audit trail" --> Records[["Kafka :29092<br/>topic platform-records"]]
    HT -- "profiles, accounts,<br/>transfers, valuations" --> Records
    Auth -- "sign-ins and locks" --> Records
    Records -- "group reporting-ingester" --> RS

    RS --> Files[("/data/reporting<br/>local files")]

    Analyst(["Analyst or admin"]) --> RUI["Reporting UI<br/>Angular :4300"]
    RUI -- "/auth: login, refresh" --> Auth
    RUI -- "/api/reporting" --> RS
```

The UI reaches both Java services through one relative `/api` prefix, and the Auth Service through a relative `/auth` prefix, that the dev proxy and the local Nginx image split by path (CloudFront does the same in the [S3 layout](infrastructure/README.md#static-uis-on-s3)). The Java services never call the Auth Service per request: they verify tokens locally against its cached public keys. The Reporting UI calls the Auth Service and the Reporting Service through a proxy on its own origin. It never reads Kafka or the database itself, and neither does the Reporting Service read the database: its report runs are what its own consumer has built from `trade-events`, and its activity, customers and orders screens are answered from a read model the service builds out of the two topics' files. The report runs are served to accounts with the `ANALYST` or `ADMIN` role and the other screens to `ADMIN` only, so traders cannot use any of it; see [roles](apps/auth-service/README.md#roles).

The Order and Sell Service publishes one `trade-events` message after each committed order status change (ACCEPTED, FILLED, REJECTED or CANCELLED), keyed by account id. A latched Stop also publishes an updated ACCEPTED snapshot. Three consumer groups read the topic independently:

| Consumer group | Lives in | On each event |
| --- | --- | --- |
| `order-status-pusher` | Order and Sell Service | Pushes the status to the owning user's open `GET /api/orders/stream` connections (Server-Sent Events) |
| `portfolio-valuation-capture` | Holdings and Trade Service | On FILLED, records a portfolio valuation for the account so the portfolio chart gets a point at the moment of the trade |
| `reporting-ingester` | Reporting Service (a second process in its container) | Appends the event to JSON Lines files under `/data/reporting`; a scheduled run turns them into `report.json` and charts that the Reporting Service serves |

A consumer that is down simply resumes from its committed offset when it returns; the reporting consumer instead resumes from the end of its own files, which is the same place unless the files were lost (see [Reporting without the database](#reporting-without-the-database)). The producer never waits for a consumer, and an unreachable broker delays the order response but never changes the order outcome.

### Reporting without the database

Reporting must not compete with trading for the database, so the Reporting Service has no connection to it: no driver, no setting, no dependency on the database container. Everything it shows is published to Kafka by the service that owns the row, after the transaction that wrote it has committed:

| Topic | Published by | Carries | Key |
| --- | --- | --- | --- |
| `trade-events` | Order and Sell | Each order status change, with the order row and, for a fill, the fill, both ledger postings and the balances they left | Account id |
| `platform-records` | Auth Service | `SIGN_IN`: email, role, failed attempts and lock, never the password hash | `SIGN_IN:<userId>` |
| `platform-records` | Holdings and Trade | `CUSTOMER_PROFILE`, `TRADING_ACCOUNT`, `CASH_TRANSFER`, `PORTFOLIO_VALUATION`, `MARKET_SESSION` | `<TYPE>:<id>` |
| `platform-records` | Order and Sell | `ORDER_AUDIT`: every audit trail entry | `ORDER_AUDIT:<auditId>` |

`platform-records` is a compacted topic: each message is the current state of one row, so it keeps the latest state of every row for good, and `reporting-ingester` is its only reader. The Reporting Service applies both topics to its own in-memory tables as idempotent upserts and answers from those; see [the read model](apps/reporting-service/README.md#the-read-model).

What was in the database before these publishers existed, or was written to it by SQL, is published once by [db/tools/republish_history.py](db/README.md#reporting-feed-tools), which is the only thing that ever reads the database on reporting's behalf. The order events it republishes carry a `replay` header, and the two Java consumers skip them: an old order is not pushed to a browser or valued again.

The two Java consumers run inside their services, because a Spring Boot service is one process and a listener in it is naturally the only one. The reporting consumer is the same code and the same image as the Reporting Service and runs in its container as a second process. [serve.py](apps/reporting-service/serve.py) starts it beside gunicorn and ends the container if either stops, because the web side runs several gunicorn workers and a Kafka consumer that writes files must exist exactly once; a separate process gives that without a separate deployable. Keep exactly one Reporting Service replica: a second would take half the partitions, and each would show only the events it stored.

The files are derived data. Where each partition's file ends decides where the consumer reads next, so a container that starts with an empty disk, as a replaced ECS task does, replays both topics from the start and rebuilds them. `trade-events` is therefore kept forever (`retention.ms=-1`) and `platform-records` is compacted.

### Tracing the event flow

Each part of the flow can be followed from its description here to the code that implements it, the tests that prove it, and where a Jenkins build shows it. Test classes appear by name under a build's Test Result. The "Build Local Docker Stack" stage proves the topic and the three consumer groups exist, and the "Kafka End-to-End Flow" stage then places a real order against the built stack and shows, step by step, the two messages it published and what each consumer did with them; that checklist is archived with the build as `reports/kafka-end-to-end/evidence.txt`. Requirement numbers refer to the LEAP Business Requirements Specification.

| Capability | Requirement | Documentation | Code | Tests | Jenkins evidence |
| --- | --- | --- | --- | --- | --- |
| An order is committed as accepted before it executes, and the fill ledger commits atomically | BR-06, BR-09 | [Order flow](#order-flow), [Order and Sell: order submission](apps/order-and-sell-service/README.md#order-submission) | [OrderService](apps/order-and-sell-service/src/main/java/app/order/OrderService.java), [OrderExecutionService](apps/order-and-sell-service/src/main/java/app/order/execution/OrderExecutionService.java), [V003 migration](db/migrations/V003__Order_status_accepted.sql) | [OrderServiceExecutionFailureTest](apps/order-and-sell-service/src/test/java/app/order/OrderServiceExecutionFailureTest.java), [OrderControllerIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/OrderControllerIntegrationTest.java) | Stage "Order and Sell Service Tests" |
| A fill is priced at the authoritative market quote at the moment of execution, within the trader's saved execution buffer | BR-08, KAN-100 | [Order flow](#order-flow), [Order and Sell: order API](apps/order-and-sell-service/api.md) | [ExecutionQuoteSource](apps/order-and-sell-service/src/main/java/app/order/execution/ExecutionQuoteSource.java), [OrderExecutionService](apps/order-and-sell-service/src/main/java/app/order/execution/OrderExecutionService.java) | [ExecutionQuoteSourceTest](apps/order-and-sell-service/src/test/java/app/order/execution/ExecutionQuoteSourceTest.java), [OrderExecutionServiceTest](apps/order-and-sell-service/src/test/java/app/order/execution/OrderExecutionServiceTest.java), [OrderServiceTest](apps/order-and-sell-service/src/test/java/app/order/OrderServiceTest.java) | Stage "Order and Sell Service Tests"; end-to-end stage reports the price the real order filled at and checks the trader's cash against it |
| One `trade-events` message per committed status change | Section 3 (loose coupling) | [Architecture](#architecture) | [TradeEventPublisher](apps/order-and-sell-service/src/main/java/app/order/event/TradeEventPublisher.java), [OrderStatusEvent](apps/order-and-sell-service/src/main/java/app/order/event/OrderStatusEvent.java) | [TradeEventPublisherTest](apps/order-and-sell-service/src/test/java/app/order/event/TradeEventPublisherTest.java), [TradeEventFlowIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/event/TradeEventFlowIntegrationTest.java) (embedded broker) | Stage "Order and Sell Service Tests"; stack stage prints the `trade-events` topic with three partitions; end-to-end stage shows the ACCEPTED and FILLED messages published for a real order |
| Order status pushed live to the trader (`order-status-pusher`) and applied by the Client UI without a refresh | BR-07, section 9.2 | [Order and Sell README](apps/order-and-sell-service/README.md), [Client UI: order status](apps/client-ui/README.md#order-status) | [OrderStatusPusherListener](apps/order-and-sell-service/src/main/java/app/order/event/OrderStatusPusherListener.java), [OrderStatusStreamRegistry](apps/order-and-sell-service/src/main/java/app/order/event/OrderStatusStreamRegistry.java), [OrderStatusStreamController](apps/order-and-sell-service/src/main/java/app/order/event/OrderStatusStreamController.java), [order.service.ts](apps/client-ui/src/app/dashboard/orders/order.service.ts) | [OrderStatusPusherListenerTest](apps/order-and-sell-service/src/test/java/app/order/event/OrderStatusPusherListenerTest.java), [OrderStatusStreamRegistryTest](apps/order-and-sell-service/src/test/java/app/order/event/OrderStatusStreamRegistryTest.java), [OrderStatusStreamControllerTest](apps/order-and-sell-service/src/test/java/app/order/event/OrderStatusStreamControllerTest.java), [TradeEventFlowIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/event/TradeEventFlowIntegrationTest.java), [order.service.spec.ts](apps/client-ui/src/app/dashboard/orders/order.service.spec.ts), [recent-transactions.spec.ts](apps/client-ui/e2e/recent-transactions.spec.ts) | Stage "Order and Sell Service Tests" and "Frontend Tests"; stack stage lists `order-status-pusher` as a live consumer group; end-to-end stage shows both status frames arriving on the order stream |
| Portfolio value captured at the moment of a fill (`portfolio-valuation-capture`) | Section 9.2, BR-18 | [Holdings and Trade: portfolio valuation on fill](apps/holdings-and-trade-service/README.md#portfolio-valuation-on-fill) | [PortfolioValuationListener](apps/holdings-and-trade-service/src/main/java/app/account/PortfolioValuationListener.java) | [PortfolioValuationListenerTest](apps/holdings-and-trade-service/src/test/java/app/account/PortfolioValuationListenerTest.java), [PortfolioValuationCaptureFlowIntegrationTest](apps/holdings-and-trade-service/src/test/java/app/account/PortfolioValuationCaptureFlowIntegrationTest.java) (embedded broker) | Stage "Holdings and Trade Service Tests"; stack stage lists `portfolio-valuation-capture` as a live consumer group; end-to-end stage shows the valuation row captured for the order |
| Trade events stored as files and turned into scheduled reports with charts (`reporting-ingester`) | BR-14, BR-16, BR-17 | [Reporting README](apps/reporting-service/README.md), [Reporting UI README](apps/reporting-ui/README.md) | [consumer.py](apps/reporting-service/consumer.py), [event_store.py](apps/reporting-service/event_store.py), [report_run.py](apps/reporting-service/report_run.py), [routes.py](apps/reporting-service/routes.py) | [test_consumer.py](apps/reporting-service/tests/test_consumer.py), [test_event_store.py](apps/reporting-service/tests/test_event_store.py), [test_report_run.py](apps/reporting-service/tests/test_report_run.py), [test_runs_routes.py](apps/reporting-service/tests/test_runs_routes.py) | Stage "Reporting Service Tests"; stack stage lists `reporting-ingester` as a live consumer group; end-to-end stage shows both events in the files and the report served with the order in it |
| Every row reporting shows is published by its owner to `platform-records` | BR-16 (analysis without competing with live trading), section 3 | [Reporting without the database](#reporting-without-the-database) | Order and Sell [record](apps/order-and-sell-service/src/main/java/app/record), Holdings and Trade [record](apps/holdings-and-trade-service/src/main/java/app/record), [sign-in-publisher.service.ts](apps/auth-service/src/events/sign-in-publisher.service.ts) | Order and Sell [PlatformRecordPublisherTest](apps/order-and-sell-service/src/test/java/app/record/PlatformRecordPublisherTest.java) and [TradeEventFlowIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/event/TradeEventFlowIntegrationTest.java), Holdings and Trade [PlatformRecordPublisherTest](apps/holdings-and-trade-service/src/test/java/app/record/PlatformRecordPublisherTest.java) and [PortfolioValuationCaptureFlowIntegrationTest](apps/holdings-and-trade-service/src/test/java/app/account/PortfolioValuationCaptureFlowIntegrationTest.java), [sign-in-publisher.service.spec.ts](apps/auth-service/src/events/sign-in-publisher.service.spec.ts) | Both Java test stages and "Auth Service Tests"; stack stage shows `platform-records` with three partitions, compacted; end-to-end stage shows each service's "Published platform record" log line |
| The console is answered from Kafka alone, with no database connection | BR-16 | [Reporting README: the read model](apps/reporting-service/README.md#the-read-model) | [read_model.py](apps/reporting-service/read_model.py), [projection.py](apps/reporting-service/projection.py), [console.py](apps/reporting-service/console.py), [models.py](apps/reporting-service/models.py) | [test_read_model.py](apps/reporting-service/tests/test_read_model.py), [test_projection.py](apps/reporting-service/tests/test_projection.py), [test_console.py](apps/reporting-service/tests/test_console.py) | Stage "Reporting Service Tests"; end-to-end stage checks the reporting image has no database setting or driver, then shows the trader, the order, its ledger impact and its audit trail served to an admin |
| History in the database published to the topics, and demo history seeded | BR-16 | [db/README: reporting feed tools](db/README.md#reporting-feed-tools) | [republish_history.py](db/tools/republish_history.py), [reporting_feed.py](db/tools/reporting_feed.py), [seed_demo_history.py](db/tools/seed_demo_history.py) | [test_reporting_feed.py](db/tools/tests/test_reporting_feed.py), [test_seed_demo_history.py](db/tools/tests/test_seed_demo_history.py) | Stage "Reporting Feed Tools Tests" |
| Trading is limited to US equities, as the sponsor clarified on 20 October 2026: the simulated universe holds US equities only and the schema lets only a US equity link to a price series | BR-12 | [Market data: universe](apps/market-data/README.md#universe), [Holdings and Trade: market replay](apps/holdings-and-trade-service/README.md#market-replay) | [common.py](apps/market-data/db/scripts/python/lib/common.py), [importing.py](apps/market-data/db/scripts/python/lib/importing.py), [V001 migration](db/migrations/V001__Initialize_database.sql) (`instruments_check2`) | [test_stock_universe.py](apps/market-data/db/scripts/python/tests/test_stock_universe.py) | Stage "Synthetic Market Data Integration" imports the universe; stage "Build Local Docker Stack" seeds two days of it, and the end-to-end stage places its order against a seeded instrument |
| Cash is correct as of the last trade: the ledger sums to the balance from registration onward, and a retried deposit or withdrawal posts once | BR-10, section 9.1 | [Holdings and Trade README](apps/holdings-and-trade-service/README.md#cash-movement) | [RegistrationService](apps/holdings-and-trade-service/src/main/java/app/registration/RegistrationService.java), [CashTransactionService](apps/holdings-and-trade-service/src/main/java/app/cash/CashTransactionService.java), [V015 migration](db/migrations/V015__Cash_transaction_client_reference.sql) | [RegistrationControllerIntegrationTest](apps/holdings-and-trade-service/src/test/java/app/registration/RegistrationControllerIntegrationTest.java), [CashTransactionControllerIntegrationTest](apps/holdings-and-trade-service/src/test/java/app/cash/CashTransactionControllerIntegrationTest.java), [test_cash_transaction_reference_migration.py](apps/market-data/db/scripts/python/tests/test_cash_transaction_reference_migration.py) | Stage "Holdings and Trade Service Tests"; end-to-end stage registers a trader whose opening funds are the first ledger row |
| An order placed while the market is closed is rejected | BR-05 | [Order and Sell: order API](apps/order-and-sell-service/api.md) | [MarketHoursValidator](apps/order-and-sell-service/src/main/java/app/order/validation/impl/MarketHoursValidator.java), [ExecutionPolicy](apps/order-and-sell-service/src/main/java/app/order/execution/ExecutionPolicy.java) | [MarketHoursValidatorUnitTest](apps/order-and-sell-service/src/test/java/app/order/validation/impl/MarketHoursValidatorUnitTest.java), [OrderServiceTest](apps/order-and-sell-service/src/test/java/app/order/OrderServiceTest.java) | Stage "Order and Sell Service Tests" |
| Order history is served page by page | BR-11 | [Order and Sell: order API](apps/order-and-sell-service/api.md), [Client UI: order status](apps/client-ui/README.md#order-status) | [OrderController](apps/order-and-sell-service/src/main/java/app/order/OrderController.java), [OrderService (client)](apps/client-ui/src/app/dashboard/orders/order.service.ts) | [OrderControllerIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/OrderControllerIntegrationTest.java), [order.service.spec.ts](apps/client-ui/src/app/dashboard/orders/order.service.spec.ts) | Stage "Order and Sell Service Tests"; stage "Frontend Tests" |
| Each audit entry names the quote its stage was priced against | BR-15 | [Order and Sell: order API](apps/order-and-sell-service/api.md) | [OrderAuditEntryResponse](apps/order-and-sell-service/src/main/java/app/order/dto/OrderAuditEntryResponse.java) | [OrderAuditEntryResponseTest](apps/order-and-sell-service/src/test/java/app/order/dto/OrderAuditEntryResponseTest.java), [OrderControllerIntegrationTest](apps/order-and-sell-service/src/test/java/app/order/OrderControllerIntegrationTest.java) | Stage "Order and Sell Service Tests" |
| The trade record is permanent, attributable to a client and time, and recoverable | BR-14, section 9.4 | [Database: trade record](db/README.md#trade-record), [Infrastructure: backup and restore](infrastructure/README.md#database-backup-and-restore), [Order and Sell: audit trail](apps/order-and-sell-service/README.md#audit-trail) | [V016 migration](db/migrations/V016__Protect_trade_records.sql), [V017 migration](db/migrations/V017__Protect_client_identity.sql), [backup-database.sh](scripts/backup-database.sh), [restore-database.sh](scripts/restore-database.sh), [OrderService](apps/order-and-sell-service/src/main/java/app/order/OrderService.java) | [test_trade_record_migration.py](apps/market-data/db/scripts/python/tests/test_trade_record_migration.py), [OrderServiceTest](apps/order-and-sell-service/src/test/java/app/order/OrderServiceTest.java) | The migration test runs locally against a disposable PostgreSQL, not in Jenkins; stage "Build Local Docker Stack" applies both migrations, and the end-to-end stage cancels and archives under them |
| Broker and topic provisioning | Section 3 | [Infrastructure README](infrastructure/README.md#local-stack) | [docker-compose.local.yml](infrastructure/docker-compose/docker-compose.local.yml) (`kafka`, `reporting-service`), [kafka-start.sh](infrastructure/docker/kafka-start.sh) | Stack stage of the pipeline | Stage "Build Local Docker Stack": every expected container running, both topics described, all three groups registered; stage "Kafka End-to-End Flow": lag 0 on every group, on both topics, after the order |

### Known limitations

Accepted risks from the 21 October 2026 requirements analysis, left open on purpose. Each is a candidate for its own story.

| Area | Limitation |
| --- | --- |
| Sign-in (BR-01) | No rate limiting on sign-in or refresh. The failed-attempt counter is not reset when a lock expires. The Client UI asks for a digit and a symbol in a password; the Auth Service checks length only |
| Sessions (BR-03) | Refresh rotation is not a conditional update, so two concurrent refreshes can fork the chain. No absolute session lifetime. Tabs do not share renewed tokens, so one tab can replay a spent refresh token |
| Events (9.1, BR-07, BR-15) | No transactional outbox: a Kafka send that fails after the commit is logged and dropped, and `republish_history.py` is the recovery |
| Balances (BR-09, BR-10) | No job reconciles cached balances against the ledgers. `accounts.cash_balance` is a stale column; `users.available_funds` is the balance |
| Orders (BR-04, BR-11) | Day orders only. A rejected order is a 201 with `status: REJECTED`. Fills have no endpoint of their own; an order carries its execution price and resolution time |
| Market data (BR-08, BR-12) | Prices are replayed, not live. Any signed-in trader can move the shared clock, which every fill is priced at. The clock restarts at the configured start when the service restarts |
| Personal data (9.3) | SSNs are stored in plaintext. The profile response includes address and date of birth. The Reporting Service does not check the token audience |
| Record (9.4, BR-14) | The application's database role owns the tables and can disable the triggers. The PostgreSQL migration and trigger tests run locally, not in Jenkins. Backups are manual, with no point-in-time recovery. V009 is duplicated and migration numbers have gaps |
| Reporting (BR-16, BR-17) | One replica only; each worker rebuilds the read model in memory. Date ranges are presets, and segment means trader level |
| Usability (9.5) | No confirmation step before an order is placed |

## Authentication and request flow

```mermaid
sequenceDiagram
    actor Trader
    participant UI as Client UI
    participant Auth as Auth Service
    participant API as Java service

    Trader->>UI: Email and password
    UI->>Auth: POST /auth/login
    Auth-->>UI: Access token (RS256, 15 min) and refresh token (7 days)
    UI->>API: Request with Bearer access token
    API->>Auth: GET /.well-known/jwks.json (first use, then cached)
    API->>API: Verify signature, expiry, issuer, subject
    API-->>UI: Response scoped to the token subject
    UI->>Auth: POST /auth/refresh (access token expired)
    Auth-->>UI: New access token and rotated refresh token
```

Registration is two calls: the UI creates credentials with `POST /auth/register` on the Auth Service, then posts the profile with the returned token to `POST /api/registration` on the Holdings and Trade Service, which also opens the default account. Registrants must be at least 21: the form refuses a younger date of birth before it creates any credentials, and Holdings and Trade rejects it again with a `400`. Order and Sell exposes no registration endpoint.

## Order flow

```mermaid
sequenceDiagram
    participant UI as Client UI
    participant OS as Order and Sell Service
    participant DB as PostgreSQL

    participant K as Kafka trade-events

    UI->>OS: POST /api/orders
    OS->>DB: Transaction 1: snapshot quote/preference, insert PENDING, validate
    alt A rule fails
        OS->>DB: Mark REJECTED, write audit entry, commit
        OS->>K: REJECTED
    else All rules pass
        OS->>DB: Reserve resources, mark ACCEPTED, commit
        OS->>K: ACCEPTED
        Note over OS,DB: Conditional orders wait for eligible ticks or cancellation
        OS->>DB: Transaction 2 when eligible: fill, ledger, release reservation, mark FILLED
        OS->>K: FILLED
    end
    OS-->>UI: 201 with the order outcome
```

Acceptance and execution are separate transactions, so an order is never recorded as FILLED before its execution has committed. Execution prices the fill at the authoritative replay quote (BR-08), never at the price the trader saw, and rejects a market order whose quote falls outside the trader's saved execution buffer. If execution fails, the order stays ACCEPTED with an `EXECUTION_FAILED` audit entry and the response carries that state; the evaluator retries it with bounded backoff. Each message is published only after its transaction commits, so a consumer never sees a status the database does not hold.

## Data ownership

Every service writes only its own tables. The [Order API](apps/order-and-sell-service/api.md) describes conditional execution, immutable buffers and reservations; [trading preferences](apps/holdings-and-trade-service/api.md#trading-preferences) belong to Holdings and Trade. The schema is defined once, in [db/migrations](db/migrations), and no service runs migrations itself.

```mermaid
flowchart TB
    subgraph Auth["Auth Service"]
        A1["user_accounts<br/>refresh_tokens"]
    end
    subgraph HT["Holdings and Trade Service"]
        H1["users<br/>accounts<br/>user_watchlist<br/>terms_acceptances<br/>portfolio_valuations<br/>cash_transactions (deposits and withdrawals)"]
    end
    subgraph OS["Order and Sell Service"]
        O1["orders<br/>fills<br/>audit_trail<br/>holdings<br/>holding_movements<br/>cash_transactions (order fills)"]
    end
    subgraph MD["Market data scripts"]
        M1["simulation_sessions<br/>market_states<br/>market_behaviors<br/>quotes<br/>market_ticks<br/>candles"]
    end
    subgraph RS["Reporting Service"]
        R1["no tables, and no connection:<br/>what it consumed from Kafka and<br/>its report runs live in the<br/>reporting_files volume"]
    end
    DB[("trading_season")]
    A1 --> DB
    H1 --> DB
    O1 --> DB
    M1 --> DB
```

The Reporting Service neither writes nor reads the database. Its report runs take their trade data from the `trade-events` topic and keep it as files; its console, for admins, is answered from a read model of `trade-events` and `platform-records`, which never carry a password hash, SSN, address or date of birth; see [Reporting without the database](#reporting-without-the-database).

## CI pipeline

[infrastructure/jenkins/Jenkinsfile](infrastructure/jenkins/Jenkinsfile) runs on every branch. A failure in the parallel test group stops the pipeline.

```mermaid
flowchart LR
    Pre["Toolchain and<br/>disk checks"] --> Checkout --> Deps["npm ci"]
    Deps --> Tests
    subgraph Tests["Parallel test suites"]
        T1["Holdings and Trade"]
        T2["Order and Sell"]
        T3["Auth"]
        T4["Reporting"]
        T5["Frontend"]
        T6["Market data"]
        T7["Reporting UI"]
        T8["Reporting feed tools"]
    end
    Tests --> Sonar["SonarQube analysis<br/>and quality gate"] --> Bundles["Build UI bundles<br/>for S3"] --> E2E["Playwright E2E"] --> Stack["Build local<br/>Docker stack"] --> Flow["Kafka end-to-end<br/>flow"]
```

## Getting started

Requirements: Node.js 24.8+ (24.x), npm 11.6, JDK 21, Maven 3.9+, and Docker (or a local PostgreSQL 16).

### Docker stack

```powershell
node apps/auth-service/scripts/generate-dev-keys.mjs | Add-Content infrastructure/docker-compose/.env
docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml up -d --build
```

The UI is at http://localhost:4200 and the Reporting UI at http://localhost:4300. Their containers are a local stand-in for S3 behind CloudFront; the deployable form of each UI is its `dist/<app>/browser` folder. The database is created and migrated automatically, and the `kafka` container creates the `trade-events` and `platform-records` topics as it starts, so the auth service, the Java services and the Reporting Service wait for it to report healthy. See [infrastructure/README.md](infrastructure/README.md) for ports and the broker.

### Local processes (Windows)

Follow the [Local setup (Windows) guide](docs/local-setup/windows.md) for terminal commands to install dependencies, configure authentication, prepare local PostgreSQL, migrate and seed data, and start the services with optional local Kafka. Docker Compose is not required.

On Linux, `scripts/setup-local.sh` installs the dependencies and starts both UIs, the Auth Service and both Java services. When it starts the database from the Compose file it also starts the Compose broker and creates both topics; when it finds a local PostgreSQL it starts no broker, so start the Compose `kafka` service first and wait for it to be healthy. It does not start the Reporting Service or its consumer; start them as [apps/reporting-service](apps/reporting-service/README.md#local-development) describes.

### History for reporting

What is already in the database, and anything written to it by SQL, is in neither topic until it is published. Two tools in [db/tools](db/README.md#reporting-feed-tools) cover that, with the stack and its broker running:

```powershell
python -m venv db/tools/.venv
db/tools/.venv/Scripts/python -m pip install -r db/tools/requirements.txt
$url = 'postgresql://trading_season:password@localhost:5432/trading_season'
db/tools/.venv/Scripts/python db/tools/seed_demo_history.py --database-url $url    # optional, development only
db/tools/.venv/Scripts/python db/tools/republish_history.py --database-url $url
```

`seed_demo_history.py` gives a development database eight demo traders and six months of orders, fills, rejections, deposits and withdrawals up to the present moment, so every range of the Reporting UI has something to show; run again later, it adds only the days since. `republish_history.py` then publishes the whole database's history to the topics. Run it once when adopting this, and again after any seed. It is safe to repeat: reporting applies every message as an upsert, so nothing is counted twice.

### Development login

In development the auth service seeds three sign-ins. Production never seeds any of them.

| Sign-in | Role | Use it for |
| --- | --- | --- |
| `admin@example.com` / `admin123` | `TRADER` | Client UI |
| `analyst@example.com` / `analyst123` | `ANALYST` | Reporting UI, report runs only |
| `reporting-admin@example.com` / `admin123` | `ADMIN` | Reporting UI, every screen |

## Checks

Run from the repository root. There is no root npm project.

| Check | Command |
| --- | --- |
| UI build | `npm --prefix apps/client-ui run build` |
| UI tests | `npm --prefix apps/client-ui test -- --no-watch` |
| UI end-to-end | `npm --prefix apps/client-ui run e2e` |
| Reporting UI build | `npm --prefix apps/reporting-ui run build` |
| Reporting UI tests | `npm --prefix apps/reporting-ui test -- --no-watch` |
| Reporting UI integration tests | `npm --prefix apps/reporting-ui run e2e` |
| Holdings and Trade tests | `mvn -B -f apps/holdings-and-trade-service/pom.xml test` |
| Order and Sell tests | `mvn -B -f apps/order-and-sell-service/pom.xml test` |
| Auth tests and lint | `npm --prefix apps/auth-service test` and `npm --prefix apps/auth-service run lint` |
| Reporting tests | `python -m pytest` in `apps/reporting-service` |
| Reporting feed tools tests | `python -m pytest tests` in `db/tools` |

## API documentation

| Service | Swagger UI |
| --- | --- |
| Auth Service | http://localhost:3001/api/docs |
| Order and Sell Service | http://localhost:8081/swagger-ui.html |
| Holdings and Trade Service | http://localhost:8082/swagger-ui.html |
| Reporting Service | http://localhost:8083/docs |

Generated Java documentation is checked in under [docs/JAVA_DOCS](docs/JAVA_DOCS/index.html); see [AGENTS.md](AGENTS.md) for how to regenerate it.

## Team

- **Mohammed** - Team Lead
- **Soli** - Scrum Master
- **Sean** - Meeting Scribe and Front End Developer
- **Prisca** - Full Stack Developer
- **Chris** - Full Stack Developer
