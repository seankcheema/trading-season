# Reporting Service

**Status:** In development. Python Flask microservice for portfolio performance, trade history, and risk summaries.

## Overview

The Reporting Service reads authorized business data from the `trading_season` database and computes portfolio aggregates. It provides:
- Portfolio summaries (holdings, cash, account management)
- Trade history with filtering and drill-down
- Performance metrics (returns, Sharpe ratio, profit factor, etc.)
- Administrative and audit views (role-based)

## Technology Stack

- **Runtime:** Python 3.14+
- **Framework:** Flask 3.0
- **Database:** PostgreSQL (trading_season)
- **Authentication:** RS256 JWT via Auth Service JWKS
- **Task Scheduling:** APScheduler for periodic data refresh
- **Deployment:** Docker, Gunicorn, Nginx

## Local Development

### Prerequisites

- Python 3.14+
- PostgreSQL 14+ with `trading_season` database initialized
- Auth Service running on port 3001

### Setup

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

4. Run the service:
   ```bash
   FLASK_ENV=development python app.py
   ```

Service will be available at `http://localhost:8083`

## API Endpoints

### Public Endpoints

- `GET /health` – Service liveness check
- `GET /` – Service information

### Authenticated Endpoints (Bearer token required)

- `GET /api/reporting/portfolio` – User's portfolio summary
- `GET /api/reporting/trades` – Trade history with filtering
- `GET /api/reporting/portfolio/{accountId}/performance` – Account performance metrics

See [reporting proposal](../../docs/reference/reporting.md) for full specification.

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

Key settings:
- `DATABASE_URL` – PostgreSQL connection string using the `postgresql+psycopg://` SQLAlchemy URL form
- `AUTH_SERVICE_URL` – Auth Service location for JWKS
- `SCHEDULER_ENABLED` – Enable/disable periodic data refresh
- `SCHEDULER_INTERVAL_MINUTES` – Refresh frequency

## Database

Connects to the shared `trading_season` database (read-only access recommended).

### Relevant Tables

- `users` – User profiles and funds
- `accounts` – Account metadata
- `orders` – Order history
- `fills` – Execution records
- `holdings` – Position tracking
- `cash_transactions` – Ledger entries
- `holding_movements` – Position ledger
- `audit_trail` – Event history

## Authentication

Validates RS256 JWT tokens from Auth Service. Token must include:
- `sub` – User UUID (identifies the account owner)
- `iss` – Issuer (verified against AUTH_JWT_ISSUER)
- `exp` – Expiration time

JWKS is cached and automatically refreshed hourly.

## Scheduled Tasks

- Data refresh job runs every 15 minutes (configurable)
- Computes/materializes portfolio aggregates
- Logs refresh timestamps for monitoring

See [APScheduler](https://apscheduler.readthedocs.io/) documentation for advanced configuration.

## Testing

Run tests:
```bash
pytest
```

## Docker

Build the image:
```bash
docker build -t reporting-service:latest .
```

Run the container:
```bash
docker run -p 8083:8083 \
   -e DATABASE_URL=postgresql+psycopg://... \
  -e AUTH_SERVICE_URL=http://auth-service:3001 \
  reporting-service:latest
```

## Deployment

See [docker-compose.yml](../../infrastructure/docker-compose/docker-compose.local.yml) for full stack deployment.

## Known Limitations

- Initial implementation: read-only access to existing tables
- Performance metrics placeholder (to be implemented)
- Admin role authorization pending (tracked separately)

## See Also

- [Architecture](../../docs/reference/architecture.md) – Service topology
- [Database reference](../../docs/reference/database.md) – Schema and ownership
- [Reporting proposal](../../docs/reference/reporting.md) – Intended capability and design
