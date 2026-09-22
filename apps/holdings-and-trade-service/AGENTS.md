# Holdings and Trade Service Instructions

This service manages all trading operations, order execution, and holding updates.

## Responsibilities

- **Create trade orders** - Accept and validate new trade requests
- **Validate trade orders** - Run comprehensive validation pipeline (funds, holdings, tradability, account status)
- **Execute buys and sells** - Process order execution and settlement
- **Update holdings** - Maintain current position data through holding movements
- **Order status and history** - Provide order audit trail and execution details

## Key Packages

- `order/` - Order creation, validation, and execution core
- `order/validation/` - Validation framework and implementations
- `order/execution/` - Order execution, fills, cash transactions, and movements
- `order/audit/` - Order event audit trail
- `account/` - Trading account management
- `holding/` - Current holdings and position data
- `instrument/` - Tradable asset definitions
- `auth/` - Authentication and authorization
- `market/` - Shared market data services

## Architecture

- Shares database schema with Order and Sell Service
- Runs on port 8081 (default)
- All order mutations and executions happen here
- Order and Sell Service queries order data via this service's read APIs

## Development

Follow [database setup](../../docs/reference/database.md#disposable-business-database-setup) before running.

```sh
mvn spring-boot:run
mvn test
```

Configuration lives in [application.properties](src/main/resources/application.properties).

## HTTP Endpoints

All endpoints require an RS256 access token issued by the auth service (except public market endpoints).

- `POST /api/orders` - Create a new trade order
- `GET /api/orders/{id}` - Get order details
- `GET /api/orders` - List orders for authenticated user
- `GET /api/market/*` - Public market data endpoints (snapshots, ticks, candles)

See [API reference](../../docs/reference/api.md) for full contract details.

## Code Coverage

Must maintain at least 60% code coverage for all features:
- Create trade orders: 60%+
- Validate trade orders: 60%+
- Execute buys and sells: 60%+
- Update holdings: 60%+
- Order status and history: 60%+

Run `mvn test` to verify coverage locally. Coverage reports are in `target/site/jacoco/`.

## Testing

- Use H2 in-memory database for unit and integration tests
- Test configuration: [application-test.properties](src/test/resources/application-test.properties)
- Mirror source structure: `src/test/java/app/<package>/` mirrors `src/main/java/app/<package>/`
- Keep HTTP validation and response mapping in controllers
- Business logic belongs in services, persistence in repositories

## Dependencies

Standard Spring Boot dependencies configured in [pom.xml](pom.xml).
