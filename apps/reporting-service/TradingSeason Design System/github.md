repo: seankcheema/trading-season
branch: main

## Last sync
date: 2026-09-25T01:36:19Z

### Updated in this project
- Tokens, Archivo font and dark theme from apps/client-ui/src/styles.css
- React ports of shared-ui-components (helm) and dashboard/shared components
- Client UI kit recreated; Instrument view and Reporting console added as proposals

## Screen map
| Screen | Repo files |
| --- | --- |
| ui_kits/client-ui Landing | apps/client-ui/src/app/landing/landing.component.html, landing.component.css |
| ui_kits/client-ui Login / Register | apps/client-ui/src/app/login/login.component.html, apps/client-ui/src/app/register/register.component.html |
| ui_kits/client-ui Dashboard | apps/client-ui/src/app/dashboard/dashboard.component.html, dashboard.component.css, mock-data.ts |
| ui_kits/client-ui Dialogs | apps/client-ui/src/app/dashboard/order-submission/*, accounts/cash-transaction-dialog.component.ts, settings-dialog/* |
| ui_kits/_shared AppHeader, OrderTicket | dashboard/shared/dashboard-header-dropdown.component.ts, order-submission/order-submission.component.html |
| ui_kits/reporting-ui (proposal) | docs/reference/reporting.md, apps/reporting-ui/index.html, README.md (ERD) |
| ui_kits/instrument-view (proposal) | README.md (ERD), dashboard/shared/price-chart.component.ts |
| components/* | packages/shared-ui-components/src/lib/*, apps/client-ui/src/app/dashboard/shared/* |
| tokens/* | apps/client-ui/src/styles.css |
