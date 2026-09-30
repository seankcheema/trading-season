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
    OS["Order and Sell Service<br/>Spring Boot | Port 8081<br/><br/>Order submission/validation<br/>Order execution<br/>Order history<br/>Called by UI"]
    HT["Holdings and Trade Service<br/>Spring Boot | Port 8082<br/><br/>User profile queries<br/>Account management<br/>Holdings queries<br/>Not called by UI"]
    
    BizDB["trading_season<br/>PostgreSQL<br/>Port 5432<br/><br/>user_accounts, refresh_tokens (auth)<br/>users, accounts, orders<br/>market data"]
    Kafka["Kafka<br/>KRaft | Port 29092<br/><br/>topic trade-events<br/>3 partitions, keyed by account<br/>no producer or consumer yet"]
    
    UI -->|POST /login/refresh| Auth
    UI -->|/api/* (proxy)| OS
    
    Auth -->|verify JWKS| Auth
    OS -->|fetch JWKS cache| Auth
    HT -->|fetch JWKS cache| Auth
    
    Auth --> BizDB
    OS --> BizDB
    HT --> BizDB
    OS -.->|proposed: publish trade-events| Kafka
    
    style OS fill:#90EE90
    style HT fill:#FFB6C6
    style Auth fill:#87CEEB
    style UI fill:#FFD700
    style AuthDB fill:#E6E6FA
    style BizDB fill:#E6E6FA
    style Kafka fill:#F5DEB3
```

## Service boundaries

| Service | Technology | Port | Status | Responsibility |
| --- | --- | --- | --- | --- |
| **Client UI** | Angular 21+ | 4200 | Implemented | User interface, login, registration, dashboard |
| **Auth Service** | NestJS | 3001 | Implemented | User credentials, token issuance, session management |
| **Order and Sell Service** | Spring Boot (Java 21) | 8081 | Implemented | Order submission/validation/execution, order history |
| **Holdings and Trade Service** | Spring Boot (Java 21) | 8082 | Implemented | User profiles, account management, holdings queries |
| **Reporting UI** | Angular | 4300 | Proposed | Portfolio performance, trade history, risk summaries |
| **Reporting Service** | TBD | 8083 | Proposed | Portfolio aggregation, analytics, report generation |
| **Market Data** | Infrastructure | — | Implemented | Database migrations, synthetic data generation |
| **Kafka** | Apache Kafka (KRaft) | 29092 | Implemented | Event broker hosting trade-events; producing and consuming are proposed |

## Service naming correction

After the KAN-47/KAN-139 restructuring fix, service names now align with responsibilities:

- **Order and Sell Service** (port 8081) implements order processing (submission, validation, execution) and is the primary backend called by Client UI.
- **Holdings and Trade Service** (port 8082) provides user profile queries, account management, and market data access.

The restructuring fix corrected an earlier logic mixup. See [Order and Sell Service documentation](services/order-and-sell-service.md) and [Holdings and Trade Service documentation](services/holdings-and-trade-service.md) for current implementation status.

## Databases

Two separate PostgreSQL databases:

| Database | Owner | Purpose |
| --- | --- | --- |
| Angular UI | Login and registration against the NestJS auth service, profile submission to the Java backend, dashboard route protection, failed sign-in lockout, inactivity sign-out, shared components | [Routes](../../apps/client-ui/src/app/app.routes.ts) |
| Spring Boot backend | Token-authenticated profile registration and user APIs, plus public simulated market reads | [Java auth controller](../../apps/holdings-and-trade-service/src/main/java/app/auth/AuthController.java) |
| NestJS auth service | Email/password login, RS256 access tokens, opaque refresh tokens, JWKS, liveness | [Auth controller](../../apps/auth-service/src/auth/auth.controller.ts) |
| Shared UI | Angular components consumed through @shared/ui-components subpath exports | [Package manifest](../../packages/shared-ui-components/package.json) |
| Reporting | Runnable HTTP placeholders only; no reporting behavior | [Reporting proposal](reporting.md) |

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
- The reporting containers are availability placeholders only and do not establish a reporting runtime or API contract. See [reporting](reporting.md).

The `trading_season` database is shared by Order and Sell Service and Holdings and Trade Service:

- **Order and Sell Service** – Reads and writes orders, fills, holdings, cash transactions, holding movements, audit trail
- **Holdings and Trade Service** – Reads user profiles and account metadata only
- **Market Data** – Owns all migrations; neither service owns the schema

Both services use JPA to map to the same tables directly. This requires schema version alignment across deployments. See [Market Data documentation](services/market-data.md) for migration rules.

## Client UI integration

The dev proxy (`apps/client-ui/proxy.conf.json`) forwards all `/api` requests to Order and Sell Service (port 8081) exclusively:

- Auth Service (port 3001) is called directly for login/register/refresh
- Holdings and Trade Service (port 8082) is not called from the UI in normal operation

## Known limitations

1. **Incomplete account data** – Holdings and Trade Service does not yet implement complete account query endpoints. See [Holdings and Trade Service documentation](services/holdings-and-trade-service.md) for current status.

2. **Market data duplication** – Both Order and Sell Service and Holdings and Trade Service contain market data endpoints. See [Order and Sell Service documentation](services/order-and-sell-service.md) for why.

3. **NestJS integration edge cases** – Bootstrap does not install global validation, cookie parser, or CORS. Refresh tokens must be sent as JSON body, not cookies. See [Auth Service documentation](services/auth-service.md) for details.

## Proposed reporting services

Reporting UI and Reporting Service are proposed but not yet implemented. When built, they will:

- **Reporting UI** (port 4300) – Display portfolio performance, trade history, drawdown, returns, and risk summaries. Provide administrative operational and audit views. Use shared Angular components.
- **Reporting Service** (port 8083) – Read-only access to authorized business data from Order and Sell Service; compute aggregates such as Sharpe/Sortino ratios, win rate, and profit factor. Must not write operational records.

Both services will authenticate via the Auth Service and may read from the `trading_season` database. Reporting store decisions (technology, refresh frequency, retention, timezone) remain unresolved. See [Reporting proposal](reporting.md) for intended capability and first implementation slice.

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
