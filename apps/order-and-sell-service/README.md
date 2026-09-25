# Order and Sell Service

Spring Boot microservice providing read-only access to user profiles, client information, holdings data, and order history. This service powers the dashboard UI and customer-facing queries.

## Architecture

**Responsibilities:**
- Provide user profile and client information
- Enable customer lookup functionality
- Query current holdings by client
- Access complete trade history
- Aggregate portfolio data

**Port:** 8082 (default, configurable via `server.port`)

**Database:** Shared PostgreSQL with Holdings and Trade Service. Schema is read-only; migrations managed centrally.

**Authentication:** RS256 tokens issued by the NestJS auth service. Verifies tokens, never handles passwords.

**Documentation:** See [service instructions](AGENTS.md) for development guidelines.

## Quick Start

### Prerequisites

- JDK 21
- Maven 3.9+
- PostgreSQL (shared with Holdings and Trade Service)
- NestJS auth service running on port 3001

### Setup

1. Create the trading_season database and apply migrations (V001, V002, V003):
   ```powershell
   # From repository root
   py -3 -m venv apps/business-backend/db/.venv
   apps/business-backend/db/.venv/Scripts/python.exe -m pip install --upgrade pip
   apps/business-backend/db/.venv/Scripts/python.exe -m pip install -r apps/business-backend/db/scripts/requirements.txt
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
   ```powershell
   Invoke-RestMethod http://localhost:8082/api/users
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

## API Endpoints

All endpoints require valid RS256 access token except public market GET endpoints.

**User Management:**
- `GET /api/users/{id}` - Get user profile by ID (requires auth)
- `GET /api/users` - List all users (admin only)

**Account Data:**
- `GET /api/accounts/{accountId}` - Get account details (requires auth)
- `GET /api/accounts/{accountId}/holdings` - Get current holdings (requires auth)

**Order History:**
- `GET /api/orders` - List all orders for authenticated user (requires auth)
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
├── user/        # User profiles and customer information
├── account/     # Read-only account entities
├── holding/     # Read-only position data
├── auth/        # Authentication and authorization
├── market/      # Market data and replay
└── Main.java    # Application entry point
```

## Requirements

Per user story AC:
- Holds user, account, holding, auth, market packages
- All previous tests pass
- Code coverage is at least 70% for every sub-bullet:
  - Client information: 70%+
  - Customer Lookup: 70%+
  - Holdings by client: 70%+
  - Trade history: 70%+
  - Portfolio Data: 70%+
- Comprehensive README (this file)
- Updated docker-compose to reflect architectural changes

## Development

See [service development guide](AGENTS.md) for coding standards, testing patterns, and contribution workflow.

## Related Services

- **Holdings and Trade Service** - Manages order execution, holds master order data
- **Auth Service** - Issues and validates RS256 tokens
- **Business UI** - Consumes this service's APIs for dashboard and user management

See [Architecture reference](../../docs/reference/architecture.md) for service boundaries and integration patterns.
