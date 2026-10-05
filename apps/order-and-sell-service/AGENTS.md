# Order and Sell Service Instructions

This service owns order submission, validation, execution, instrument reference data, and order history on port 8081. Holdings and Trade owns profiles, accounts, cash operations, and holdings reads on port 8082. Both share the business database.

- Resolve user ownership from the verified token subject before reading or writing an account.
- Keep validation and response mapping in controllers, business logic in services, and persistence in repositories.
- Execute fills, shared user cash balance updates, cash transactions, holding movements, holdings, and audit changes in one transaction. A persistence failure must roll back the whole submission.
- Reject orders whose credential record no longer exists. Account activation status was removed; do not restore it implicitly.
- Preserve real audit timestamps separately from the simulation cursor and retain idempotent client references.
- Mirror source packages under `src/test/java/app`. Use H2 with the test profile, and cover cross-user isolation and buy/sell ledgers.
- Run `mvn -B test`; JaCoCo enforces the configured 70 percent floor per package on every counter.
- Update affected Javadoc comments and regenerate both services with the pinned plugin as required by the root instructions.

- **User profiles** - Provide user account information
- **Holdings queries** - Query current position data and holdings
- **Order history** - Provide order audit trail and execution details
- **Read-only access** - All endpoints are read-only queries of master data held in Holdings and Trade Service

## Key Packages

- `user/` - User profile and account information
- `holding/` - Current holdings and position data queries
- `order/` - Order history and audit queries
- `order/event/` - Publishes one Kafka `trade-events` message per resolved order after commit; hosts the `reporting-ingester` and `order-status-pusher` consumer groups, which only log. Gated by `app.events.enabled`.
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
See [API reference](../../docs/reference/api.md), [Database](../../docs/reference/database.md), and [Development](../../docs/guides/development.md) for canonical contracts and commands.
