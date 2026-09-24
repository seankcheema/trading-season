# Service Reference

Detailed documentation for each service in the Trading Season platform.

| Service | Status | Responsibility |
| --- | --- | --- |
| [Client UI](client-ui.md) | Implemented | Login, registration, dashboard with live market data |
| [Auth Service](auth-service.md) | Implemented | Email/password authentication, token issuance, session management |
| [Holdings and Trade Service](holdings-and-trade-service.md) | Implemented | Order submission, validation, execution; account and holdings management |
| [Order and Sell Service](order-and-sell-service.md) | Implemented | User profile queries, market data access |
| [Market Data](market-data.md) | Implemented | Database migrations, synthetic market data tooling |
| [Reporting Service](reporting-service.md) | Proposed | Portfolio analytics and performance reporting |
| [Reporting UI](reporting-ui.md) | Proposed | Analytics dashboard and visualizations |

## Architecture overview

The platform consists of:

- **Frontend**: Angular client application (Client UI) with shared component library
- **Authentication**: NestJS-based auth service with RS256 tokens and refresh rotation
- **Backend**: Two independent Spring Boot microservices sharing a single PostgreSQL database
- **Infrastructure**: Docker Compose setup, Jenkins CI/CD, shared database migrations

See [Architecture Reference](../architecture.md) for system-level integration details.

## Database schema

Both Java services connect to the same `trading_season` PostgreSQL database. Schema migrations and initialization scripts are maintained in [Market Data](market-data.md) to support independent microservice deployments.

See [Database Reference](../database.md) for schema ownership, relationships, and migration procedures.
