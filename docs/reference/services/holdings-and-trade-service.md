# Holdings and Trade Service

**Folder:** `apps/holdings-and-trade-service` | **Port:** 8081 | **Framework:** Spring Boot (Java 21)

The primary backend service handling order submission, validation, execution, and account management. This is the only backend service called by Client UI.

## Service responsibilities

Despite the name, this service implements order processing and execution. It is also the exclusive target of Client UI's `/api` requests (via dev proxy). See [Architecture Reference](../architecture.md#the-naming-does-not-match-the-split) for the naming discrepancy and naming resolution.

### Implemented capabilities

- User account registration and profile management
- Order submission and validation pipeline
- Order execution with market impact
- Holdings tracking and updates
- Account balance management
- Market data publication (snapshots, candles, streaming quotes)
- Audit trail recording

## Verified API endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/register` | POST | Bearer token | Register user account |
| `/api/users/me` | GET | Bearer token | Retrieve caller's profile |
| `/api/orders` | POST | Bearer token | Submit order for execution |
| `/api/market/snapshot` | GET | Public | Get current market quotes |
| `/api/market/candles` | GET | Public | Retrieve price candles for analysis |
| `/api/market/stream` | GET | Public | Stream live market ticks |
| `/api/market/clock` | PUT | Bearer token | Control simulation clock (admin) |

## Order validation pipeline

Orders are validated in fixed sequence; validation stops at first rejection:

1. **Account Status Validator** – Account must be active and in good standing
2. **Sufficient Funds Validator** – Caller must have adequate cash balance
3. **Sufficient Holdings Validator** – Caller must own sufficient shares (for sell orders)
4. **Tradability Validator** – Instrument must be trading in the current market session

Additional validators can be added by implementing `OrderValidator` under `app.order.validation.impl`; the `OrderValidationPipeline` collects all Spring-managed validator beans automatically.

## Internal structure

```
app/
├── auth/              # User registration and authentication
│   ├── AuthController
│   └── AuthService
├── user/              # User profile queries
│   ├── UserController
│   └── UserService
├── order/             # Order submission, validation, execution
│   ├── OrderController
│   ├── OrderService
│   ├── validation/    # Pipeline and validator implementations
│   ├── execution/     # Order execution logic
│   └── audit/         # Audit trail recording
├── market/            # Market data publication
│   ├── MarketController
│   └── MarketReplayService
├── account/           # Account JPA entities
├── holding/           # Holdings JPA entities
├── instrument/        # Instrument JPA entities
└── common/            # Shared utilities
```

## Data ownership

Connects to `trading_season` PostgreSQL database with JPA entities for:
- `accounts` – Account balances and settings
- `users` – User profiles
- `orders` – Order records
- `fills` – Execution records
- `holdings` – Position tracking
- `instruments` – Tradable assets
- `cash_transactions` – Ledger entries
- `holding_movements` – Position changes
- `audit_trail` – Event log

Does not own database migrations; see [Market Data](market-data.md).

## Known gaps in this service's own README

The `apps/holdings-and-trade-service/README.md` documents:
- `GET /api/orders/{id}` – Retrieve order by ID
- `GET /api/orders` – List orders

**Neither endpoint is implemented.** The `OrderController` contains exactly one `@PostMapping` and no `@GetMapping`. Do not rely on that section of the README for existing functionality.

## Development setup

```powershell
cd apps/holdings-and-trade-service
mvn spring-boot:run
```

The service runs on port 8081. Ensure the `trading_season` database is initialized with migrations from [Market Data](market-data.md).

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
