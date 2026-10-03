# Business Backend Database Instructions

This directory is now dedicated to database setup and management. The Java backend has been refactored into two microservices:

- **Holdings and Trade Service** (`../holdings-and-trade-service/`) - Order execution, validation, holdings
- **Order and Sell Service** (`../order-and-sell-service/`) - User profiles, holdings queries, order history

## Database Files

- `db/migrations/V001__Initialize_database.sql` - SQL migration scripts (the canonical V001__Initialize_database.sql)
- `db/scripts/python/` - Python workflow scripts for initialization, generation, validation, import
- `db/seeds/` - Generated market data archive (local developer data, not committed)
- `db/scripts/powershell/setup-market-data.ps1` - Orchestrates market data generation workflow

## Usage

Follow [database setup guide](../../docs/reference/database.md) for:
- Creating the trading_season database
- Applying the canonical schema
- Setting up synthetic market data

Both microservices share this database and connect via environment variables in docker-compose or application.properties.

## Development Rules

- Keep db/migrations/V001__Initialize_database.sql canonical for fresh setup; upgrades to retained databases require a separately reviewed incremental change
- Keep database setup separate from service code
- Both services must be deployed together with the same schema version
- Schema initialization requires an empty public schema and preserves existing data

