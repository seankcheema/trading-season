# Business Backend Database Setup

This directory contains database migrations, scripts, and synthetic market data setup for the Trading Season platform. The Java backend has been refactored into two microservices:

- **[Holdings and Trade Service](../holdings-and-trade-service/)** - Manages order execution, validation, and holdings updates (port 8081)
- **[Order and Sell Service](../order-and-sell-service/)** - Provides user profiles, holdings queries, and order history (port 8082)

Both services share a single PostgreSQL database managed through the migration scripts in this directory.

## Database Setup

The business database stores trading data (orders, holdings, accounts) and market data for simulations. Follow [database setup instructions](../../docs/reference/database.md#disposable-business-database-setup) to initialize and seed the database.

### Prerequisites

- PostgreSQL 16+
- Python 3.x with pip
- Available disk space for market data (optional)

### Initial Setup

1. Create the `trading_season` database:
   ```sql
   CREATE DATABASE trading_season;
   CREATE USER trading_season WITH PASSWORD 'changeme';
   GRANT ALL PRIVILEGES ON DATABASE trading_season TO trading_season;
   ```

2. Set up Python environment for database scripts:
   ```powershell
   py -3 -m venv db/.venv
   db/.venv/Scripts/python.exe -m pip install --upgrade pip
   db/.venv/Scripts/python.exe -m pip install -r db/scripts/requirements.txt
   ```

3. Run migrations (V001, V002, V003):
   ```sh
   # See detailed instructions in ../../docs/reference/database.md
   ```

### Synthetic Market Data (Optional)

Generate and import simulated market data for testing:
```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb `
  -InitializeDisposableDatabase
```

## Files

- `migrations/` - SQL migration files (V001, V002, V003)
- `scripts/` - Python scripts for initialization, generation, validation, and import
- `seeds/` - Generated market data archive (local developer data, not committed)
- `setup-market-data.ps1` - PowerShell script to orchestrate market data workflow
- `tests/` - Database tests and validation

## Docker

Both microservices are built and deployed via Docker. See:
- [docker-compose.local.yml](../../infrastructure/docker-compose/docker-compose.local.yml) - Local development
- [Dockerfile](../holdings-and-trade-service/Dockerfile) - Holdings and Trade Service
- [Dockerfile](../order-and-sell-service/Dockerfile) - Order and Sell Service

## Related Documentation

- [Database Reference](../../docs/reference/database.md) - Schema, migrations, ERD
- [Architecture](../../docs/reference/architecture.md) - Service boundaries and integration
- [Development Guide](../../docs/guides/development.md) - Development workflow

