# Order and Sell Service

**Folder:** `apps/order-and-sell-service` | **Port:** 8082 | **Framework:** Spring Boot (Java 21)

A microservice running independently of the main UI flow. Currently does not handle order submission, validation, or execution.

## Current status

This service is running and connected to the `trading_season` database but is **not called by Client UI**. The dev proxy forwards all `/api` requests exclusively to Holdings and Trade Service on port 8081.

## What it actually does

- **Account registration** – Nearly identical implementation to Holdings and Trade Service
- **User profile queries** – `GET /api/users/me` only (caller's own profile)
- **Market data access** – Public market snapshots, candles, streaming quotes, and simulation clock control

## What it does NOT do

Despite descriptions in previous READMEs claiming this service provides:
- Holdings queries
- Order history

**Neither is implemented.** There is:
- No holdings endpoint anywhere in the source code
- No order history endpoint
- No `app.order` package
- No order-related functionality

The `app.holding` and `app.account` JPA entities and repositories exist but are unused; nothing in this service queries them.

## Verified API endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/register` | POST | Bearer token | Register user account |
| `/api/users/me` | GET | Bearer token | Retrieve caller's profile only |
| `/api/market/snapshot` | GET | Public | Get current market quotes |
| `/api/market/candles` | GET | Public | Retrieve price candles |
| `/api/market/stream` | GET | Public | Stream live market ticks |
| `/api/market/clock` | PUT | Bearer token | Control simulation clock |

## Internal structure

```
app/
├── auth/              # User registration (copy of Holdings and Trade Service)
│   ├── AuthController
│   └── AuthService
├── user/              # User profile queries
│   ├── UserController
│   └── UserService
├── market/            # Market data publication
│   ├── MarketController
│   └── MarketReplayService
├── account/           # JPA entities (unused)
├── holding/           # JPA entities and repository (unused)
└── common/            # Shared utilities
```

The `account` and `holding` repositories are present but never called by any controller or service.

## Data ownership

Connects to `trading_season` PostgreSQL database but only reads user profiles:
- `users` – User profile data

Does not own database migrations; see [Market Data](market-data.md).

## Known gaps

The `apps/order-and-sell-service/README.md` and root `README.md` both claim this service provides holdings queries and order history. This represents intended architecture, not implemented functionality. If you need those features, see the [Architecture Reference](../architecture.md#the-naming-does-not-match-the-split) for current status and next steps.

## Development setup

```powershell
cd apps/order-and-sell-service
mvn spring-boot:run
```

The service runs on port 8082 but is not called by Client UI in normal operation.

## Testing

Run tests:

```powershell
cd apps/order-and-sell-service
mvn test
```

Generate Javadocs:

```powershell
mvn org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
```

## Future work suggestions

If this service is intended to grow into its described role, the natural next steps are:

1. Implement `HoldingController` and `HoldingService` using the existing `HoldingRepository`
2. Implement an `app.order` package for order history (read-only; execution stays in Holdings and Trade Service)
3. Update this documentation to reflect the new capabilities
4. Update Client UI routing or dev proxy to call this service for holdings and order history

This is a design suggestion, not an existing implementation.

## See also

- [Architecture Reference](../architecture.md) for system design and the service split rationale
- [API Reference](../api.md) for endpoint details
- [Database Reference](../database.md) for schema ownership
- [Holdings and Trade Service](holdings-and-trade-service.md) for the sibling service and current order handling
- [Market Data](market-data.md) for database initialization
