# Reporting Service

Flask service (Python 3.14) that reads the shared `trading_season` database and returns portfolio, trade-history, performance, and profile views for the signed-in caller. It never writes business tables. Status: in development; performance metrics are partly placeholder and admin-role views are not built.

- Port 8083, Swagger UI at http://localhost:8083/docs, OpenAPI at `/openapi.yaml`
- Served by Gunicorn in Docker. The matching [Reporting UI](../reporting-ui/README.md) is only a placeholder page.

## Endpoints

Authenticated endpoints need an RS256 bearer token from the [Auth Service](../auth-service/README.md). Data is always scoped to the token's `sub`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service information (public) |
| GET | `/health` | Liveness and database check (public) |
| GET | `/api/reporting/portfolio` | Portfolio summary across the caller's accounts |
| GET | `/api/reporting/portfolio/{accountId}` | One account's portfolio |
| GET | `/api/reporting/portfolio/{accountId}/performance` | One account's performance metrics |
| GET | `/api/reporting/portfolio/performance` | Aggregate performance |
| GET | `/api/reporting/trades` | Trade history with filtering and pagination |
| GET | `/api/reporting/trades/{orderId}` | Trade or order detail |
| GET | `/api/reporting/trades/statistics` | Aggregate trade statistics |
| GET | `/api/reporting/trades/drill-down` | Grouped trade analytics |
| GET | `/api/reporting/profile` | Caller profile summary |
| GET | `/api/reporting/scheduler/status` | Refresh scheduler status (public) |

[openapi.yaml](openapi.yaml) is the canonical contract. Keep it, [routes.py](routes.py), [app.py](app.py), and the tests in step.

## Design

```mermaid
flowchart LR
    Client --> App["app.py<br/>Flask app, /health, /docs, require_auth"]
    App --> Routes["routes.py<br/>/api/reporting blueprint"]
    Routes --> Repos["db_service.py<br/>read-only repositories"]
    Repos --> Models["models.py<br/>SQLAlchemy models"]
    Models --> DB[("trading_season")]
    Sched["scheduled_tasks.py<br/>APScheduler, every 15 min"] --> Repos
    Sched --> Meta["reporting_metadata<br/>last refresh time"]
    App -. "JWKS, cached 1 h" .-> Auth["Auth Service"]
```

### Authenticated request

```mermaid
sequenceDiagram
    actor Client
    participant A as require_auth
    participant J as JWKS cache
    participant R as Route handler
    participant D as Repositories

    Client->>A: GET /api/reporting/... with Bearer token
    A->>J: Public keys (refetched after 1 hour)
    A->>A: Verify RS256 signature, exp, iss
    alt Invalid or missing token
        A-->>Client: 401
    else Valid
        A->>R: sub as user id
        R->>D: Query accounts, orders, fills, holdings, cash
        D-->>R: Rows for that user only
        R-->>Client: JSON
    end
```

Tables read: `users`, `accounts`, `orders`, `fills`, `holdings`, `cash_transactions`, `holding_movements`, `audit_trail`, `instruments`.

## Configuration

Copy [.env.example](.env.example) to `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://trading_season:password@localhost:5432/trading_season` | Database (`postgres://` and `postgresql://` are normalized) |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | Where JWKS is fetched |
| `AUTH_JWT_ISSUER` | `http://localhost:3001` | Required `iss`; must equal the auth service's `JWT_ISSUER` |
| `CORS_ORIGINS` | `http://localhost:4200` | Allowed origins, comma-separated |
| `REPORTING_SERVICE_HOST`, `REPORTING_SERVICE_PORT` | `0.0.0.0`, `8083` | Bind address |
| `SCHEDULER_ENABLED`, `SCHEDULER_INTERVAL_MINUTES` | `True`, `15` | Periodic refresh job |

## Run and test

```sh
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
FLASK_ENV=development python app.py
python -m pytest
```

Start the database, migrated per [db/README.md](../../db/README.md), and the auth service first. Docker:

```sh
docker build -t reporting-service .
docker run -p 8083:8083 -e DATABASE_URL=postgresql+psycopg://... -e AUTH_SERVICE_URL=http://auth-service:3001 reporting-service
```

Do not add fallback signing keys, disable issuer checks, or widen data scope beyond the token's `sub`.
