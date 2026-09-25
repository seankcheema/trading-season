# Order and Sell Service Instructions

This service provides read-only access to user profiles, order history, and holdings queries.

## Responsibilities

- **User profiles** - Provide user account information
- **Holdings queries** - Query current position data and holdings
- **Order history** - Provide order audit trail and execution details
- **Read-only access** - All endpoints are read-only queries of master data held in Holdings and Trade Service

## Key Packages

- `user/` - User profile and account information
- `holding/` - Current holdings and position data queries
- `order/` - Order history and audit queries
- `instrument/` - Tradable asset definitions
- `auth/` - Authentication and authorization
- `market/` - Shared market data services

## Architecture

- Shares database schema with Holdings and Trade Service
- Runs on port 8082 (default)
- All endpoints are read-only queries
- Queries order data, holdings, and user profiles from Holdings and Trade Service

## Development

Follow [database setup](../../docs/reference/database.md#disposable-business-database-setup) before running.

```sh
mvn spring-boot:run
mvn test
```

Configuration lives in [application.properties](src/main/resources/application.properties).

## HTTP Endpoints

All endpoints require an RS256 access token issued by the auth service (except public market endpoints).

- `GET /api/users/{id}` - Get user profile
- `GET /api/accounts/{accountId}` - Get account details
- `GET /api/accounts/{accountId}/holdings` - Get current holdings
- `GET /api/orders` - List order history for authenticated user
- `GET /api/market/*` - Public market data endpoints (snapshots, ticks, candles)

See [API reference](../../docs/reference/api.md) for full contract details.

## Code Coverage

Must maintain at least 70% code coverage for all features:
- Client information: 70%+
- Customer Lookup: 70%+
- Holdings by client: 70%+
- Trade history: 70%+
- Portfolio Data: 70%+

`mvn test` enforces this as a JaCoCo check: every package must reach 70% on every counter (instructions, branches, lines, complexity, methods, and classes). Coverage reports are in `target/site/jacoco/`.

## Testing

- Use H2 in-memory database for unit and integration tests
- Test configuration: [application-test.properties](src/test/resources/application-test.properties)
- Mirror source structure: `src/test/java/app/<package>/` mirrors `src/main/java/app/<package>/`
- Keep HTTP validation and response mapping in controllers
- Business logic belongs in services, persistence in repositories

## Dependencies

Standard Spring Boot dependencies configured in [pom.xml](pom.xml).
