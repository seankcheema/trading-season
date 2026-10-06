# Architecture

This document describes the system-level structure of Trading Season. For per-service detail, implementation status, and verified endpoints, see [Service Reference](services/).

## System overview

Trading Season is a monorepo containing:

- **Frontend** – Angular-based Client UI with reusable component library
- **Authentication** – NestJS service with email/password authentication and RS256 tokens
- **Backend** – Two independent Spring Boot microservices sharing a single PostgreSQL database
- **Shared Infrastructure** – Database migrations, synthetic market data tooling, Kafka broker, Docker Compose configuration

## Service topology

```mermaid
graph TB
    UI["Client UI<br/>Angular 21+ | Port 4200"]
    Auth["Auth Service<br/>NestJS | Port 3001"]
    OS["Order and Sell Service<br/>Spring Boot | Port 8081<br/><br/>Order submission/validation<br/>Order execution<br/>Order history<br/>Instrument reference data<br/>Called by UI"]
    HT["Holdings and Trade Service<br/>Spring Boot | Port 8082<br/><br/>User profile queries<br/>Account management<br/>Holdings queries<br/>Called by UI"]
    
    BizDB["trading_season<br/>PostgreSQL<br/>Port 5432<br/><br/>user_accounts, refresh_tokens (auth)<br/>users, accounts, orders<br/>market data"]
    Kafka["Kafka<br/>KRaft | Port 29092<br/><br/>topic trade-events<br/>3 partitions, keyed by account<br/>one message per order status change"]
    
    UI -->|POST /login/refresh| Auth
    UI -->|/api/* (proxy)| OS
    
    Auth -->|verify JWKS| Auth
    OS -->|fetch JWKS cache| Auth
    HT -->|fetch JWKS cache| Auth
    
    Auth --> BizDB
    OS --> BizDB
    HT --> BizDB
    RC["Reporting consumer<br/>Python | group reporting-ingester<br/><br/>events as JSON lines<br/>report run every 15 min"]
    RS["Reporting Service<br/>Flask | Port 8083<br/><br/>serves report runs"]
    Files[("reporting_files volume<br/>events/*.jsonl<br/>runs/<id>/report.json, *.png")]

    OS -->|publish after commit| Kafka
    Kafka -->|group order-status-pusher| OS
    OS -->|GET /api/orders/stream, SSE| UI
    Kafka -->|poll, commit| RC
    RC -->|append events, write runs| Files
    RC -->|read users, accounts| BizDB
    Files -->|read| RS
    
    style OS fill:#90EE90
    style HT fill:#FFB6C6
    style Auth fill:#87CEEB
    style UI fill:#FFD700
    style AuthDB fill:#E6E6FA
    style BizDB fill:#E6E6FA
    style Kafka fill:#F5DEB3
    style RC fill:#F5DEB3
    style RS fill:#DDA0DD
    style Files fill:#E6E6FA
```

## Service boundaries

| Service | Technology | Port | Status | Responsibility |
| --- | --- | --- | --- | --- |
| **Client UI** | Angular 21+ | 4200 | Implemented | User interface, login, registration, dashboard |
| **Auth Service** | NestJS | 3001 | Implemented | User credentials, token issuance, session management |
| **Order and Sell Service** | Spring Boot (Java 21) | 8081 | Implemented | Order submission/validation/execution, order history, instrument reference data |
| **Holdings and Trade Service** | Spring Boot (Java 21) | 8082 | Implemented | User profiles, account management, holdings queries |
| **Reporting UI** | Angular | 4300 | Proposed | Report list, viewer and parameters; static placeholder today |
| **Reporting Service** | Python 3.14, Flask | 8083 | Implemented | Serves report runs (`report.json` and PNG charts) from the `reporting_files` volume; reads `users` and `accounts` only. See [Reporting](reporting.md) |
| **Reporting consumer** | Python 3.14 (same image) | — | Implemented | Consumer group `reporting-ingester`: appends `trade-events` to JSON line files and writes a report run every 15 minutes |
| **Market Data** | Infrastructure | — | Implemented | Database migrations, synthetic data generation |
| **Kafka** | Apache Kafka (KRaft) | 29092 | Implemented | Event broker hosting trade-events. Order and Sell publishes one message per committed order status change (`ACCEPTED`, `FILLED`, `REJECTED`), keyed by account id ([TradeEventPublisher](../../apps/order-and-sell-service/src/main/java/app/order/event/TradeEventPublisher.java)). Two groups read it: `order-status-pusher` in Order and Sell forwards each outcome to the owner's open `GET /api/orders/stream` connections; `reporting-ingester` in the reporting consumer stores it for reports |

## Service naming correction

After the KAN-47/KAN-139 restructuring fix, service names now align with responsibilities:

- **Order and Sell Service** (port 8081) implements order processing (submission, validation, execution) and is the primary backend called by Client UI.
- **Holdings and Trade Service** (port 8082) provides user profile queries, account management, and market data access, and is also called by Client UI.

The restructuring fix corrected an earlier logic mixup. See [Order and Sell Service documentation](services/order-and-sell-service.md) and [Holdings and Trade Service documentation](services/holdings-and-trade-service.md) for current implementation status.

## Databases

Two separate PostgreSQL databases:

| Database | Owner | Purpose |
| --- | --- | --- |
| Angular UI | Login and registration against the NestJS auth service, profile submission to the Java backend, dashboard route protection, failed sign-in lockout, inactivity sign-out, shared components | [Routes](../../apps/client-ui/src/app/app.routes.ts) |
| Spring Boot backend | Token-authenticated profile registration and user APIs, plus public simulated market reads | [Java auth controller](../../apps/holdings-and-trade-service/src/main/java/app/auth/AuthController.java) |
| NestJS auth service | Email/password login, RS256 access tokens, opaque refresh tokens, JWKS, liveness | [Auth controller](../../apps/auth-service/src/auth/auth.controller.ts) |
| Shared UI | Angular components consumed through @shared/ui-components subpath exports | [Shared components](../../apps/client-ui/shared-ui-components/README.md) |
| Reporting | Kafka consumer storing trade events as files, scheduled report runs with PNG charts, authenticated endpoints serving the runs; UI still a placeholder | [Reporting](reporting.md) |

All three services share the `trading_season` database, and each table has one writer. The auth service owns `user_accounts` and `refresh_tokens`; the Java services own the profile and trading tables. The value joining an account to its profile is the user UUID (`user_accounts.user_id` ↔ `users.user_id`), which is also the access token's `sub` claim.

## Authentication flow

```
1. Client → Auth Service (POST /auth/login)
   Email + password → RS256 access token + refresh token

2. Client → Order and Sell Service (API request with Bearer token)
   Service verifies signature independently using cached JWKS from Auth Service

3. On token expiry:
   Client → Auth Service (POST /auth/refresh)
   Refresh token → New access token
```

Neither Java service calls the Auth Service per request. Each fetches and caches the JWKS independently.

- UI registration sends a profile without username or password, which the Java register contract does not yet accept, so registration cannot complete end to end until the backend is updated.
- NestJS logout is guarded by an access JWT and forwards that JWT to a service method expecting an opaque refresh token. Do not rely on this endpoint to revoke a refresh session until the mismatch is fixed.
- NestJS bootstrap does not install a global validation pipe, cookie parser, or CORS configuration. DTO fields alone do not imply runtime validation; use JSON body refresh tokens.
- The Passport JWT strategy restricts RS256 and checks expiry but does not configure issuer/audience enforcement.
- The reporting UI container is a static placeholder; the reporting service and consumer are real. See [reporting](reporting.md).

The `trading_season` database is shared by Order and Sell Service and Holdings and Trade Service:

- **Order and Sell Service** – Reads and writes orders, fills, holdings, cash transactions, holding movements, audit trail
- **Holdings and Trade Service** – Reads user profiles and account metadata only
- **Market Data** – Owns all migrations; neither service owns the schema

Both services use JPA to map to the same tables directly. This requires schema version alignment across deployments. See [Market Data documentation](services/market-data.md) for migration rules.

## Client UI integration

The UI reaches both Java services through one relative `/api` prefix, split by path:

- `/api/orders` and `/api/instruments` go to Order and Sell Service (port 8081), which owns trading
- Everything else under `/api` goes to Holdings and Trade Service (port 8082): profile, accounts, holdings, cash and market data
- Auth Service (port 3001) is called directly for login/register/refresh

The split is configured twice, once per environment: [proxy.conf.json](../../apps/client-ui/proxy.conf.json) for the dev server and [nginx.conf](../../apps/client-ui/nginx.conf) for the container image. Adding a path to one and not the other is the failure mode to watch for.

## Known limitations

1. **No order history on the dashboard** – `GET /api/orders` returns the caller's orders, but there is still no per-order or per-account read, and the dashboard's recent activity list shows cash movements only. Order submission itself is wired: the dashboard's order dialog posts to `POST /api/orders` and shows the fill or the rejection reason.

2. **Market data duplication** – Both Order and Sell Service and Holdings and Trade Service contain market data endpoints. See [Order and Sell Service documentation](services/order-and-sell-service.md) for why.

3. **NestJS integration edge cases** – Bootstrap does not install global validation, cookie parser, or CORS. Refresh tokens must be sent as JSON body, not cookies. See [Auth Service documentation](services/auth-service.md) for details.

## Reporting

The reporting service and its consumer are implemented; see [Reporting](reporting.md) for the pipeline. In short: the consumer stores every `trade-events` message as a JSON line on the `reporting_files` volume and every 15 minutes writes a report run with PNG charts; the Flask service serves the runs behind the same RS256 tokens as the Java services. Reporting reads `users` and `accounts` from `trading_season` and nothing else, and owns no table (BR-16).

Still proposed: the **Reporting UI** (port 4300), which will show the report list, a viewer for a run's data and charts, and report parameters. It is a static placeholder today and belongs to a separate UI story.

## Change boundaries

- Put reusable UI components in the shared package; application logic stays in its owning app
- All schema changes go in the same `trading_season` migrations, including the auth service's tables
- Never edit an applied database migration; always add new ones
- Both Java services must deploy against the same `trading_season` schema version

## See also

- [Service Reference](services/) for per-service structure and endpoints
- [API Reference](api.md) for implemented HTTP contracts
- [Database Reference](database.md) for schema, ownership, and relationships
- [Development Guide](../guides/development.md) for local setup and verification
- [Operations Guide](../guides/operations.md) for configuration and troubleshooting
