# Order and Sell Service

Spring Boot microservice responsible for managing all trading operations, order execution, and holding updates. This service is the core trading engine for the Trading Season platform.

## Architecture

**Responsibilities:**
- Create and accept trade orders
- Validate orders (funds, holdings, tradability)
- Execute buy and sell transactions
- Update and maintain current holdings
- Maintain complete order audit trail and history
- Commit an accepted order before executing it (BR-06), then execute in a separate transaction
- Publish one `trade-events` message per committed status change (`ACCEPTED`, `FILLED`, `REJECTED`)
- Run the `order-status-pusher` consumer group, which forwards each status change to the owner's open `GET /api/orders/stream` connections (the reporting service owns the `reporting-ingester` group)

**Port:** 8081 (default, configurable via `server.port`)

**Database:** Shared PostgreSQL with Order and Sell Service. Schema is read-only; migrations managed centrally.

**Authentication:** RS256 tokens issued by the NestJS auth service. Verifies tokens, never handles passwords.

**Documentation:** See [service instructions](AGENTS.md) for development guidelines.

## Quick Start

### Prerequisites

- JDK 21
- Maven 3.9+
- PostgreSQL (shared with Order and Sell Service)
- NestJS auth service running on port 3001
- Kafka broker with the `trade-events` topic, from Local Compose (`up -d kafka-init`). The service starts without it, but every order then waits up to five seconds for the broker before responding.

### Setup

1. Create the trading_season database and apply migrations (V001 through V004):
   ```powershell
   # From repository root
   py -3 -m venv apps/market-data/db/.venv
   apps/market-data/db/.venv/Scripts/python.exe -m pip install --upgrade pip
   apps/market-data/db/.venv/Scripts/python.exe -m pip install -r apps/market-data/db/scripts/requirements.txt
   ```

2. Run migrations:
   ```sh
   # See database setup guide in ../../docs/reference/database.md
   ```

3. Start the service:
   ```sh
   mvn spring-boot:run
   ```

4. Verify it's running:
   ```powershel

   Invoke-RestMethod http://localhost:8081/api/market/snapshot
   ```

### Tests

Run all tests with code coverage verification:
```sh
mvn test
```

Coverage must be at least 70% in every package on every JaCoCo counter (instructions, branches, lines, complexity, methods, and classes); `mvn test` fails otherwise. Reports are in `target/site/jacoco/`.

## Configuration

Environment variables override defaults in [application.properties](src/main/resources/application.properties):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/trading_season` | Database connection |
| `SPRING_DATASOURCE_USERNAME` | `trading_season` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | `changeme` | Database password |
| `AUTH_JWK_SET_URI` | `http://localhost:3001/.well-known/jwks.json` | Auth service JWKS endpoint |
| `AUTH_JWT_ISSUER` | `https://auth.dualeapa.local` | Required JWT issuer claim |
| `CORS_ORIGINS` | `http://localhost:4200` | Allowed browser origins (comma-separated) |
| `MARKET_REPLAY_ARCHIVE_LOCATION` | empty | Optional absolute Parquet archive root override |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:29092` | Event broker for `trade-events`; Compose sets `kafka:9092` |

The property `app.events.enabled` (default `true`) registers the trade-event publisher and both consumers; the test profile sets it to `false` so contexts without a broker never contact one.

Parquet-backed simulation sessions first use `MARKET_REPLAY_ARCHIVE_LOCATION`, then the archive location recorded during import, and finally discover the matching archive under the repository's `apps/market-data/db/seeds` directory. This discovery keeps an existing database usable after the repository moves. Missing raw tick partitions return an unavailable market-data error rather than falling back to one-minute candles.

## API Endpoints

All endpoints require valid RS256 access token except public market GET endpoints.

**User Management:**
- `GET /api/users/{id}` - Get user profile by ID (requires auth)
- `GET /api/users` - List all users (admin only)

**Account Data:**
- `GET /api/accounts/{accountId}` - Get account details (requires auth)
- `GET /api/accounts/{accountId}/holdings` - Get current holdings (requires auth)

**Order History:**
- `GET /api/orders` - List the authenticated caller's orders across all of their accounts, newest first (requires auth)

**Orders:**
- `POST /api/orders` - Submit a buy or sell order; created PENDING and returned FILLED, REJECTED, or ACCEPTED when execution failed and the order stays on record (requires auth)
- `GET /api/orders/{id}` - Get order details (requires auth)
- `GET /api/orders/stream` - Server-sent events: `order-status` with each committed status change's JSON body, `heartbeat` every 15 seconds (requires auth; the client must send the bearer header, which native `EventSource` cannot)

**Market Data (Public):**
- `GET /api/market/snapshot` - Current market snapshot
- `GET /api/market/quotes` - Current quotes for all stocks
- `GET /api/market/stream` - SSE stream of market ticks

For full API contracts, see [API reference](../../docs/reference/api.md).

## Code Organization

Source is rooted at `src/main/java/app`. Tests mirror structure under `src/test/java/app`.

```
app/
├── order/           # Order management core
│   ├── validation/  # Validation pipeline
│   ├── execution/   # Order execution and settlement
│   ├── audit/       # Order event audit
│   └── event/       # trade-events publisher, order-status-pusher consumer, order status stream
├── account/         # Trading account entities
├── holding/         # Current position data
├── instrument/      # Tradable asset definitions
├── auth/            # Authentication and authorization
├── market/          # Market data and replay
└── Main.java        # Application entry point
```


## Development

See [service development guide](AGENTS.md) for coding standards, testing patterns, and contribution workflow.

## Related Services

- **Order and Sell Service** - Queries orders, holdings, and user data for UI
- **Auth Service** - Issues and validates RS256 tokens
- **Business UI** - Consumes this service's APIs

See [Architecture reference](../../docs/reference/architecture.md) for service boundaries and integration patterns.
