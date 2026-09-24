# Order and Sell Service

Spring Boot microservice responsible for managing all trading operations, order execution, and holding updates. This service is the core trading engine for the Trading Season platform.

## Architecture

**Responsibilities:**
- Create and accept trade orders
- Validate orders (funds, holdings, tradability, account status)
- Execute buy and sell transactions
- Update and maintain current holdings
- Maintain complete order audit trail and history

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

### Setup

1. Create the trading_season database and apply migrations (V001, V002, V003):
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

Coverage must be at least 60% per AC requirements. Reports are in `target/site/jacoco/`.

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

## API Endpoints

All endpoints require valid RS256 access token except public market GET endpoints.

**Order History:**
- `GET /api/orders` - List order history for authenticated user (requires auth)
- `GET /api/orders/{id}` - Get order details (requires auth)

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
│   └── audit/       # Order event audit
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
