# Holdings and Trade Service

**Folder:** `apps/holdings-and-trade-service` | **Port:** 8082 | **Framework:** Spring Boot (Java 21)

Provides user registration, profile queries, and market data. Account and holdings queries are planned but not implemented. This service is not called by Client UI.

## Service responsibilities

This service handles user profile lookups and is intended to own account and holdings queries. See [Architecture Reference](../architecture.md) for service responsibilities after the restructuring fix.

### Implemented capabilities

- User account registration and profile management
- Market data publication (snapshots, candles, streaming quotes, simulation clock)

### Planned capabilities

- Account details and holdings queries (`GET /api/me/accounts`, `GET /api/accounts/{accountId}/holdings`). The `Account` and `Holding` entities and repositories exist, but no controller or service exposes them yet.

### Note on Order and Sell Service

Order submission, validation, execution, and complete order history are handled by [Order and Sell Service](order-and-sell-service.md) on port 8081, which is the exclusive backend target of Client UI.

## Verified API endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/account-exists` | POST | Public | Check if email exists |
| `/api/auth/register` | POST | Bearer token | Register user account |
| `/api/users/me` | GET | Bearer token | Retrieve caller's profile |
| `/api/market/snapshot` | GET | Public | Get current market quotes |
| `/api/market/candles` | GET | Public | Retrieve price candles for analysis |
| `/api/market/stream` | GET | Public | Stream live market ticks |
| `/api/market/clock` | PUT | Bearer token | Control simulation clock |

## Internal structure

```
app/
├── auth/              # User registration and authentication
│   ├── AuthController
│   └── AuthService
├── user/              # User profile queries
│   ├── UserController
│   └── UserService
├── account/           # Account JPA entity and repository (no controller yet)
├── holding/           # Holding JPA entity and repository (no controller yet)
└── market/            # Market data publication
    ├── MarketController
    └── MarketReplayService
```

## Data ownership

Connects to `trading_season` PostgreSQL database with JPA entities for:
- `users` – User profiles
- `accounts` – Account records
- `holdings` – Position tracking

Does not own database migrations; see [Market Data](market-data.md).

## Development setup

```powershell
cd apps/holdings-and-trade-service
mvn spring-boot:run
```

The service runs on port 8082. Ensure the `trading_season` database is initialized with migrations from [Market Data](market-data.md).

## Testing

Run unit and integration tests:

```powershell
cd apps/holdings-and-trade-service
mvn test
```

Generate Javadocs:

```powershell
mvn org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
```

## See also

- [Architecture Reference](../architecture.md) for system design and integration
- [API Reference](../api.md) for detailed request/response contracts
- [Database Reference](../database.md) for schema ownership
- [Order and Sell Service](order-and-sell-service.md) for the sibling service
- [Market Data](market-data.md) for database initialization
