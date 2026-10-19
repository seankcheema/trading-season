# Reporting console kit (proposed — not in the product)

`apps/reporting-ui` in the repo is a static placeholder ("Reporting functionality is not implemented yet."). This kit is a **new design** for analysts who observe platform activity and support customers, built from TradingSeason's client-UI vocabulary (dash cards, uppercase labels, gain/loss pills, PriceChart).

Grounding: `docs/reference/reporting.md` (summaries, time-range filters, charts, drill-down tables, admin operational/audit views, label stale data) and the business + auth schemas (`users.account_status`, `failed_attempts`, `locked_until`, `orders.status/order_type/client_reference`, `fills`, `cash_transactions`, `audit_trail.event_type`).

Screens:
- **Activity** (`ActivityScreen.jsx`) — range toggle, 5 KPIs, notional chart, orders by status, live activity feed, most traded.
- **Customers** (`CustomersScreen.jsx`) — searchable list → customer detail with lock banner + "Unlock now", profile, security, balances, orders.
- **Orders** (`OrdersScreen.jsx`) — search + status filter; row opens a Dialog with the order's audit-trail timeline.

The sidebar uses the codebase's `--sidebar*` token values (#141414 surface, 10% frost border), which exist in `styles.css` but aren't used by the client UI.

Open questions for the team: KPI definitions (fill rate, net cash flow), whether support can unlock accounts or only view, and data freshness/timezone labelling.
