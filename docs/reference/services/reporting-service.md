# Reporting Service

**Folder:** `apps/reporting-service` | **Port:** Not yet assigned | **Status:** Proposed

A planned service for portfolio performance analytics, trade reporting, and risk analysis. No implementation exists yet.

## Intended capabilities

Provide traders and administrators with:
- Portfolio performance and return calculations
- Drawdown and volatility analysis
- Trade history and execution analysis
- Risk metrics (Sharpe/Sortino ratios, exposure, concentration)
- Administrative audit views scoped by user role

## Proposed architecture

See [Reporting Proposal](../reporting.md) for detailed requirements, open decisions, and acceptance criteria.

### Key constraints

- Read-only access to business data – Must never become another writer of order/accounting records
- Derived data only – Any reporting database is secondary to operational ledgers
- Authorization – Depends on resolving auth integration with the main platform

## Current status

The `apps/reporting-service/README.md` contains documentation of intended purpose only. No source code, build configuration, or API implementation exists.

## First implementation slice

When ready to start, begin with:

1. Agree on one portfolio return calculation and its source data
2. Implement a tested service query for one account and time range
3. Add UI summary page and trade drill-down
4. Include error states, accessible chart alternatives, and responsive layouts

## Next steps

Before implementation starts:

- Decide runtime environment (Spring Boot, NestJS, Python, other)
- Agree on return calculation formulas and currency handling
- Establish data refresh frequency and latency requirements
- Define authorization contract with other services
- Determine whether aggregation uses scheduled jobs or on-demand queries

## See also

- [Reporting Proposal](../reporting.md) for full requirements and decision tree
- [Reporting UI](reporting-ui.md) for the frontend service
- [API Reference](../api.md) for implemented business endpoints
- [Database Reference](../database.md) for schema details
