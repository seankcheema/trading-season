# Order and Sell Service Instructions

This service provides client information, customer lookup, holdings queries, and trade history to the UI and other consumers.

## Responsibilities

- **Client information** - User profiles and account details
- **Customer Lookup** - Find users and accounts in the system
- **Holdings by client** - Query current positions for a user
- **Trade history** - Access order history and execution details
- **Portfolio Data** - Aggregate account and holding information

## Key Packages

- `user/` - User profiles and customer information
- `account/` - Read-only access to trading accounts
- `holding/` - Read-only access to current positions
- `auth/` - Authentication and authorization
- `market/` - Shared market data services

## Architecture

- Shares database schema with Holdings and Trade Service
- Runs on port 8082 (configurable via environment)
- Read-only access to orders, holdings, and account data
- Calls Holdings and Trade Service APIs for trading operations
- Provides data aggregation for the UI dashboard

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
- `GET /api/market/*` - Public market data endpoints

See [API reference](../../docs/reference/api.md) for full contract details.

## Code Coverage

Must maintain at least 60% code coverage for all features:
- Client information: 60%+
- Customer Lookup: 60%+
- Holdings by client: 60%+
- Trade history: 60%+
- Portfolio Data: 60%+

Run `mvn test` to verify coverage locally. Coverage reports are in `target/site/jacoco/`.

## Testing

- Use H2 in-memory database for unit and integration tests
- Test configuration: [application-test.properties](src/test/resources/application-test.properties)
- Mirror source structure: `src/test/java/app/<package>/` mirrors `src/main/java/app/<package>/`
- Keep HTTP validation and response mapping in controllers
- Business logic belongs in services, persistence in repositories

## Dependencies

Standard Spring Boot dependencies configured in [pom.xml](pom.xml).
