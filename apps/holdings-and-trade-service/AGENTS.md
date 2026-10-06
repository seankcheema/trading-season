# Holdings and Trade Service Instructions

This service owns the signed-in user's own data: their profile, their accounts, the positions those accounts hold, and the cash the accounts share. It also serves the simulated market feed. It is the backend Client UI calls.

Order creation, validation and execution live in [Order and Sell Service](../order-and-sell-service/AGENTS.md), not here.

## Responsibilities

- **Profile registration and reads** - Create the caller's profile from the registration form and return it
- **Accounts** - List, open and rename the caller's accounts; open a default account at registration
- **Holdings** - Report an owned account's positions with their symbol and average cost
- **Cash** - Deposit and withdraw the user's shared funds, and list the resulting ledger
- **Market data** - Serve the shared simulation snapshot, candles and tick stream

## Key Packages

- `auth/` - Registration, token wiring, security configuration, and error mapping
- `user/` - The caller's profile and the shared cash balance it carries
- `account/` - The caller's accounts and the assembled view of their holdings
- `cash/` - Deposits, withdrawals, and the append-only cash ledger
- `holding/` - Cached positions, plus the movement and fill rows a position's cost is derived from
- `instrument/` - Read access to tradable asset definitions, for naming a holding
- `market/` - Shared market data services

## Architecture

- Shares the database schema with Order and Sell Service. Each service maps only the tables it reads, so the same table can be mapped in both.
- Runs on port 8082 (default). The dev server proxies `/api` here; see [proxy.conf.json](../client-ui/proxy.conf.json).
- Writes to `users.available_funds` only alongside a `cash_transactions` row, in one transaction (BR-09/15). Order fills move the same balance from the other service.
- Reads `holding_movements` and `fills` to derive cost basis; it never writes them.

## Data scope

Every user-specific endpoint resolves the owner from the verified token's `sub` claim. An account id in a path is checked against that owner before anything is read or written: another user's account is 403, a nonexistent one is 404. Cash endpoints take no account at all. Do not add an endpoint that accepts a user or owner id from the request.

## Development

Set up a migrated database ([db/README.md](../../db/README.md)) before running.

```sh
mvn spring-boot:run
mvn test
```

Configuration lives in [application.properties](src/main/resources/application.properties).

## HTTP Endpoints

All endpoints require an RS256 access token issued by the auth service, except `POST /api/auth/account-exists` and the public market GET endpoints.

- `POST /api/auth/account-exists` - Whether an email is registered (public)
- `POST /api/auth/register` - Create the caller's profile and default account
- `GET /api/users/me` - The caller's profile, without the SSN
- `GET/PUT/DELETE /api/me/watchlist` - The caller's saved stocks (PUT/DELETE take `/{symbol}`)
- `GET /api/me/accounts` - The caller's accounts
- `POST /api/me/accounts` - Open a new, empty account
- `PUT /api/me/accounts/{accountId}` - Rename an owned account
- `GET /api/accounts/{accountId}` - An owned account
- `GET /api/accounts/{accountId}/holdings` - An owned account's positions
- `GET /api/me/cash-transactions` - The caller's deposits and withdrawals
- `POST /api/me/cash-transactions` - Deposit or withdraw funds
- `GET /api/market/*` - Public market data endpoints (snapshots, candles, stream)
- `PUT /api/market/clock` - Move the shared replay cursor

See the [README](README.md) for endpoint details.

## Code Coverage

`mvn test` enforces coverage as a JaCoCo check: every package must reach the `coverage.minimum` floor in [pom.xml](pom.xml) on every counter (instructions, branches, lines, complexity, methods, and classes). The floor is currently 85%, so a new package needs tests before the build will pass. A package with no branches has no branch ratio and is not held to that limit. Reports are in `target/site/jacoco/`.

## Testing

- Use H2 in-memory database for unit and integration tests
- Test configuration: [application-test.properties](src/test/resources/application-test.properties)
- The H2 schema is created from the mapped entities, so a query can only reach a table some entity maps
- `@DataJpaTest` is not available; use `@SpringBootTest` with `@Transactional` for repository tests
- Mirror source structure: `src/test/java/app/<package>/` mirrors `src/main/java/app/<package>/`
- Cover cross-user isolation for every user-specific endpoint: one user must never read or change another's data
- Keep HTTP validation and response mapping in controllers
- Business logic belongs in services, persistence in repositories

## Dependencies

Standard Spring Boot dependencies configured in [pom.xml](pom.xml).
