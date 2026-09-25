# Order and Sell Service

**Folder:** `apps/order-and-sell-service` | **Port:** 8081 | **Framework:** Spring Boot (Java 21)

The primary backend service for the Trading Season platform, handling order submission, validation, and execution. This is the exclusive backend service called by Client UI.

## Service responsibilities

This service implements the complete order processing pipeline and is the authoritative source for order state. See [Architecture Reference](../architecture.md) for complete service topology.

### Implemented capabilities

- User account registration and profile management
- Order submission and validation pipeline
- Order execution with market impact
- Holdings and cash updates as part of order execution (holding movements and cash transactions)
- Market data publication (snapshots, candles, streaming quotes)
- Audit trail recording

Order lookup, order history, and cash transaction endpoints are planned but not implemented; see [API Reference](../api.md#planned-trading-endpoints).

## Verified API endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/account-exists` | POST | Public | Check if email exists |
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
└── instrument/        # Instrument JPA entities
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

## Development setup

```powershell
cd apps/order-and-sell-service
mvn spring-boot:run
```

The service runs on port 8081 and is the primary backend target of Client UI (via dev proxy).

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

## See also

- [Architecture Reference](../architecture.md) for system design and the service split rationale
- [API Reference](../api.md) for endpoint details
- [Database Reference](../database.md) for schema ownership
- [Holdings and Trade Service](holdings-and-trade-service.md) for the sibling service
- [Market Data](market-data.md) for database initialization
