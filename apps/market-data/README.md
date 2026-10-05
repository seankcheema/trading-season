# Business Backend Database Setup

This directory contains the canonical database schema, scripts, and synthetic market data setup for the Trading Season platform. The Java backend has been refactored into two microservices:

- **[Holdings and Trade Service](../holdings-and-trade-service/)** - Manages order execution, validation, and holdings updates (port 8081)
- **[Order and Sell Service](../order-and-sell-service/)** - Provides user profiles, holdings queries, and order history (port 8082)

Both services share a single PostgreSQL database managed through the schema setup in this directory.

## Database Setup

The business database stores trading data (orders, holdings, accounts) and market data for simulations. Follow [database setup instructions](../../docs/reference/database.md#disposable-business-database-setup) to initialize and seed the database.

### Prerequisites

- PostgreSQL 16+
- Python 3.x with pip
- Available disk space for market data (optional)

### Initial Setup

1. Create the `trading_season` database:
   ```sql
   CREATE USER trading_season WITH PASSWORD 'changeme';
   CREATE DATABASE trading_season OWNER trading_season;
   ```

2. Set up Python environment for database scripts:
   ```powershell
   py -3 -m venv apps/market-data/db/.venv
   apps/market-data/db/.venv/Scripts/python.exe -m pip install --upgrade pip
   apps/market-data/db/.venv/Scripts/python.exe -m pip install -r apps/market-data/db/scripts/python/requirements.txt
   ```

3. Apply the schema once to the empty database:
   ```sh
   apps/market-data/db/scripts/powershell/setup-database.ps1 -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season
   ```

### Synthetic Market Data (Optional)

Generate and import simulated market data for testing:
```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/market-data/db/scripts/powershell/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb `
  -InitializeDisposableDatabase
```

## Files

- `db/migrations/V001__Initialize_database.sql` - Canonical schema for all 19 tables
- `db/scripts/python/` - Python entry points, shared library, configuration, and requirements
- `seeds/` - Generated market data archive (local developer data, not committed)
- `db/scripts/powershell/` - Database setup and market-data workflow launchers

## Docker

Both microservices are built and deployed via Docker. See:
- [docker-compose.local.yml](../../infrastructure/docker-compose/docker-compose.local.yml) - Local development
- [Dockerfile](../holdings-and-trade-service/Dockerfile) - Holdings and Trade Service
- [Dockerfile](../order-and-sell-service/Dockerfile) - Order and Sell Service

## Related Documentation

- [Database Reference](../../docs/reference/database.md) - Schema, migrations, ERD
- [Architecture](../../docs/reference/architecture.md) - Service boundaries and integration
- [Development Guide](../../docs/guides/development.md) - Development workflow

