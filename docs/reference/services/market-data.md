# Market Data

**Folder:** `apps/market-data` | **Not a running service** – Infrastructure and tooling only

Contains shared database migrations, synthetic market data generation scripts, and related tooling. Both Holdings and Trade Service and Order and Sell Service depend on this.

## What it contains

| Path | Purpose |
| --- | --- |
| `db/migrations/` | Database schema: `V001__Initial_schema.sql`, `V002__Synthetic_market_data_replay_metadata.sql`, `V003__Token_authentication.sql` |
| `db/scripts/` | Python scripts for market data generation, validation, and import workflow |
| `db/seeds/` | Generated output archives (not committed to repository) |
| `db/setup-market-data.ps1` | PowerShell orchestration for data generation workflow |
| `db/tests/` | Test suite for data import/generation workflow validation |

## Why a separate folder

Both Java microservices connect to the same `trading_season` database with their own JPA entities. Since neither owns the schema exclusively, migrations and shared tooling live here to support independent deployments.

## Database initialization

The schema is applied through three SQL migrations applied in order:

1. **V001__Initial_schema.sql** – Creates base schema, tables, and relationships
2. **V002__Synthetic_market_data_replay_metadata.sql** – Adds replay metadata for synthetic data simulation
3. **V003__Token_authentication.sql** – Removes legacy authentication columns, adds token support

All migrations are applied to the `trading_season` database by either Java service on first startup (via Hibernate/JPA configuration) or manually via `psql`.

See [Database Reference](../database.md) for full schema details, table ownership, and relationships.

## Synthetic market data

The scripts generate repeatable, parameterized market data for testing and simulation:

1. **Initialize** – Create simulation session and seed stocks
2. **Generate** – Create market behaviors, states, quotes, and ticks for the session
3. **Validate** – Verify generated data consistency and completeness
4. **Import** – Load validated data into the database

The setup script orchestrates these steps:

```powershell
cd apps/market-data/db
.\setup-market-data.ps1
```

## Migration rules

Per the [AGENTS.md](../../AGENTS.md) in this folder:

- **Never edit an applied migration** – Database state becomes non-deterministic
- **Always add a new migration** for schema changes
- **Both Java services must deploy against the same schema version** – They read and write the same tables directly

## Development setup

No installation needed; migrations are automatically applied by Java services on startup. To manually initialize:

```powershell
# Via psql (requires local PostgreSQL)
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 \
  -f apps/market-data/db/migrations/V001__Initial_schema.sql

psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 \
  -f apps/market-data/db/migrations/V002__Synthetic_market_data_replay_metadata.sql

psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 \
  -f apps/market-data/db/migrations/V003__Token_authentication.sql
```

Or via Docker Compose:

```powershell
docker compose -f infrastructure/docker-compose/docker-compose.local.yml up -d db
```

## See also

- [Architecture Reference](../architecture.md) for system design
- [Database Reference](../database.md) for schema details and ownership
- [Holdings and Trade Service](holdings-and-trade-service.md)
- [Order and Sell Service](order-and-sell-service.md)
