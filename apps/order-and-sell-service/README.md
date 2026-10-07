# Order and Sell Service

Spring Boot (Java 21) service that submits, validates, and executes buy and sell orders, and serves instrument reference data and order history. It is the trading half of the backend; accounts, cash, and holdings reads belong to the [Holdings and Trade Service](../holdings-and-trade-service/README.md).

- Port 8081, Swagger UI at http://localhost:8081/swagger-ui.html
- Shares the `trading_season` database. The schema comes from [db/migrations](../../db/migrations); Hibernate never alters it.
- Authenticates callers by verifying RS256 tokens from the [Auth Service](../auth-service/README.md) against its cached JWKS. The caller is always the token's `sub`.

## Endpoints

All require a bearer token except the public market reads.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/orders` | Submit a buy or sell order. Returns 201 with the outcome (`FILLED` or `REJECTED`) |
| GET | `/api/orders` | The caller's orders across all their accounts, newest first |
| GET | `/api/instruments` | Every instrument with `tradable` and `simulatedStockSymbol` |
| POST | `/api/auth/account-exists` | Whether an email is registered (public) |
| POST | `/api/auth/register` | Create the caller's profile from the bearer token |
| GET | `/api/users/me` | The caller's profile, without the SSN |
| GET | `/api/market/snapshot`, `/candles`, `/stream` | Public market data (snapshot, OHLCV candles, SSE ticks) |
| PUT | `/api/market/clock` | Move the shared replay cursor |

Order request: `accountId`, `instrumentId`, `orderType` (`BUY` or `SELL`), `quantity`, `indicativePrice`, `clientReference` (UUID idempotency key), and optional `bufferPercent` and `simulatedAt`.

Behavior worth knowing:

- A rule failure is a normal outcome: the response is still 201 with `status: REJECTED` and a `rejectionReason`.
- Resubmitting the same `accountId` and `clientReference` returns the original outcome without executing again.
- Another user's account is 403 and a missing account is 404, checked before the idempotency lookup. An unknown `instrumentId` is 400.
- Cash belongs to the user, not the account: a fill moves `users.available_funds`. Orders fill at `indicativePrice`.
- `simulatedAt` records the replay time chosen in the UI. `submittedAt`, `resolvedAt`, and fill times are always real server times.
- Errors use `{"error": "..."}`.

## Design

```mermaid
flowchart TB
    subgraph Web["Web layer"]
        OC[OrderController]
        IC[InstrumentController]
        UC[UserController]
        AC[auth.AuthController]
        MC[market.MarketController]
    end
    subgraph Domain["Order domain"]
        OS[OrderService]
        VP[OrderValidationPipeline]
        subgraph Rules["OrderValidator rules"]
            V1[AccountCredentialsValidator]
            V2[TradabilityValidator]
            V3[SufficientFundsValidator]
            V4[SufficientHoldingsValidator]
        end
        OE[OrderExecutionService]
        AT[AuditTrailService]
    end
    subgraph Data["JPA entities"]
        E1["Order, Fill, CashTransaction,<br/>HoldingMovement, AuditTrail"]
        E2["Account, Holding, User,<br/>UserAccount, Instrument"]
    end
    OC --> OS
    OS --> VP
    VP --> Rules
    OS --> OE
    OS --> AT
    OE --> AT
    OS --> E1
    OE --> E1
    OS --> E2
    OE --> E2
    IC --> E2
    UC --> E2
    MC --> MR[MarketReplayService]
```

### Order submission

```mermaid
sequenceDiagram
    participant C as OrderController
    participant S as OrderService
    participant P as ValidationPipeline
    participant E as OrderExecutionService
    participant DB as PostgreSQL

    C->>S: submitOrder(request, callerId)
    S->>DB: Load account, check owner (403 or 404)
    S->>DB: Look up accountId + clientReference
    alt Already processed
        S-->>C: Original order
    else New
        S->>DB: Load user and instrument (400 if instrument unknown)
        S->>DB: Insert order PENDING and audit entry
        S->>P: run(request, user, account, instrument)
        alt A rule fails
            S->>DB: Mark REJECTED with reason and audit entry
        else All rules pass
            S->>E: execute(order, instrument)
            E->>DB: Lock user row and holding row
            alt Funds or holdings changed since validation
                E->>DB: Mark REJECTED
            else Still valid
                E->>DB: Insert fill, cash transaction, holding movement
                E->>DB: Update available funds and holding
                E->>DB: Mark FILLED and audit entry
            end
        end
        S-->>C: Order in its final status
    end
```

Submission runs in one transaction, so a persistence failure rolls back the order and its whole ledger together.

### Order status

```mermaid
stateDiagram-v2
    [*] --> PENDING: submitted
    PENDING --> REJECTED: rule fails or funds/holdings changed
    PENDING --> FILLED: fill and ledger written
    REJECTED --> [*]
    FILLED --> [*]
```

Every transition is recorded in `audit_trail`, along with an `ACCEPTED` event when the rules pass. Migration V010 makes orders, fills, the ledgers, and the audit trail append-only; see the [trade record](../../docs/reference/trade-record.md) for the events and what the database rejects. A new validation rule is a new `OrderValidator` class; the pipeline discovers it automatically and stops at the first rejection.

## Configuration

Environment variables override [application.properties](src/main/resources/application.properties).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/trading_season` | Database |
| `SPRING_DATASOURCE_USERNAME` | `trading_season` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | `changeme` | Database password |
| `AUTH_JWK_SET_URI` | `http://localhost:3001/.well-known/jwks.json` | Auth service public keys |
| `AUTH_JWT_ISSUER` | `https://auth.dualeapa.local` | Required `iss`, must equal the auth service's `JWT_ISSUER` |
| `CORS_ORIGINS` | `http://localhost:4200` | Allowed browser origins, comma-separated |
| `MARKET_REPLAY_ARCHIVE_LOCATION` | empty | Absolute path to the Parquet archive when the recorded path is not reachable |

## Run and test

Start a migrated database ([db/README.md](../../db/README.md)) and the auth service, then:

```sh
mvn spring-boot:run
mvn test
```

Tests use H2 with the `test` profile and mirror the source packages under `src/test/java/app`. JaCoCo fails the build below 70 percent on every counter in any package (`coverage.minimum` in [pom.xml](pom.xml)); reports are in `target/site/jacoco/`.

After changing Java code, regenerate the Javadocs; see [AGENTS.md](../../AGENTS.md).
