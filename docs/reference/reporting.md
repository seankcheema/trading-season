# Reporting proposal

Status: proposed functionality with runnable container placeholders. The reporting UI serves a static placeholder page, and the reporting service exposes only placeholder and health JSON responses. No reporting API, calculation, scheduler, framework, authorization integration, persistence, or analytics store is implemented.

## Intended capability

Provide traders with portfolio performance, drawdown, returns, trade history, and risk summaries. Provide administrators with operational and audit views scoped to their role. Candidate measures include Sharpe/Sortino ratios, win rate, profit factor, exposure, and concentration; formulas and required inputs must be agreed before implementation.

## Proposed boundaries

- Reporting service reads authorized business data and computes aggregates. It must not become another writer of order/accounting records.
- Reporting UI presents summaries, time-range filters, charts, and drill-down tables using the shared Angular components.
- Any reporting store is derived data with a documented rebuild process. Operational ledgers remain authoritative.
- User identity and access control depend on resolving the existing authentication integration described in [architecture](architecture.md).

## First implementation slice

Agree one portfolio return calculation and its source data, implement a tested service query for one account/time range, then add a UI summary and trade drill-down. Include empty/loading/error states, accessible chart alternatives, keyboard navigation, and responsive layouts.

## Decisions still required

Choose the service runtime, formula conventions (cash flows, fees, periods, currency), refresh frequency, timezone, retention, and authorization contract. Decide whether aggregation needs scheduled jobs or can begin on demand. Previous Python, Quartz, caching, schema, and endpoint examples were options rather than implemented or approved contracts.

## Acceptance for future work

Reconcile computed results against deterministic fixtures, test account isolation and invalid ranges, and label stale/incomplete data. Document measured performance and data freshness requirements before introducing caching or additional infrastructure. Move implemented contracts to the [API reference](api.md) and [database reference](database.md) as work ships.
