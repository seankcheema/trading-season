# Reporting UI

**Folder:** `apps/reporting-ui` | **Port:** Not yet assigned | **Framework:** Angular (proposed) | **Status:** Proposed

A planned analytics and dashboard interface for portfolio reporting. No implementation exists yet.

## Intended capabilities

- Portfolio performance visualizations and summary metrics
- Trade history tables with filtering and sorting
- Risk analysis charts (drawdown, volatility, exposure)
- Time-range selection and drill-down navigation
- Role-based admin views for audit and compliance

## Current status

The `apps/reporting-ui/README.md` contains documentation of intended purpose only. No Angular components, routing, or styling exists.

## Dependencies

Depends on [Reporting Service](reporting-service.md), which is equally unimplemented. Until Reporting Service defines its API, this UI cannot be built.

## Technology decisions needed

- **Framework** – Angular (assumed), React, Vue, or other
- **Charting library** – Lightweight, accessible, and responsive
- **Data refresh** – Real-time subscriptions or polling strategy
- **Responsive design** – Mobile-first, tablet, or desktop-only

## Proposed structure

When implementation begins, follow the same component architecture as [Client UI](client-ui.md):

- Shared components from [shared component library](../../packages/shared-ui-components/README.md)
- Feature-based folder structure
- E2E tests with Playwright

## First implementation slice

When Reporting Service completes its first slice (one return calculation, one account/time range), build:

1. A summary card showing the calculated metric
2. A drill-down table of trades for that account and period
3. A line chart of cumulative returns
4. Filter controls for account and date range

Include empty states, loading indicators, error handling, and accessibility features.

## See also

- [Reporting Service](reporting-service.md) – The backend this UI will consume
- [Reporting Proposal](../reporting.md) for full requirements
- [Architecture Reference](../architecture.md) for system integration points
- [Client UI](client-ui.md) for the main application structure
