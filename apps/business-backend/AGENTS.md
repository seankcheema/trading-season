# Business Backend Database Instructions

This directory is now dedicated to database setup and management. The Java backend has been refactored into two microservices:

- **Holdings and Trade Service** (`../holdings-and-trade-service/`) - Order execution, validation, holdings
- **Order and Sell Service** (`../order-and-sell-service/`) - User profiles, holdings queries, order history

## Database Files

- `db/migrations/` - SQL migration scripts (V001, V002, V003)
- `db/scripts/` - Python workflow scripts for initialization, generation, validation, import
- `db/seeds/` - Generated market data archive (local developer data, not committed)
- `db/setup-market-data.ps1` - Orchestrates market data generation workflow
- `db/tests/` - Database validation tests

## Usage

Follow [database setup guide](../../docs/reference/database.md) for:
- Creating the trading_season database
- Running migrations
- Setting up synthetic market data

Both microservices share this database and connect via environment variables in docker-compose or application.properties.

## Development Rules

- Do not edit applied migrations; create new migration files for schema changes
- Keep database setup separate from service code
- Both services must be deployed together with the same schema version
- Market data initialization is destructive; only run on disposable databases

