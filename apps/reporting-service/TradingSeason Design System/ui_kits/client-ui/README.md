# Client UI kit

Recreation of `apps/client-ui` (Angular 21 + SpartanNG + Tailwind v4) from https://github.com/seankcheema/trading-season.

Screens (switch via the flow; last route persists in `localStorage['ts-client-route']`):
- **Landing** (`Landing.jsx`) — hero "Ride the market.", hairline texture, glowing cyan draw-in graph. Source: `landing/landing.component.*`
- **Login / Register** (`AuthScreens.jsx`) — lockup fixed top-left, 10px-radius card. Source: `login/`, `register/`
- **Dashboard** (`Dashboard.jsx`) — header dropdowns (market clock, account, profile), search, net-worth card, recent transactions, ticker strip, portfolio chart, assets table. Source: `dashboard/dashboard.component.*`
- **Dialogs** (`Dialogs.jsx`) — New Order (two-column, chart + ticket), Deposit/Withdraw, Settings. Source: `order-submission/`, `accounts/cash-transaction-dialog`, `settings-dialog/`

Shared with other kits: `../_shared/AppHeader.jsx`, `../_shared/OrderTicket.jsx`, `../_shared/market-data.js`.

The "Full view" button in New Order is a **new** affordance linking to the Instrument view kit; it does not exist in the product yet.
