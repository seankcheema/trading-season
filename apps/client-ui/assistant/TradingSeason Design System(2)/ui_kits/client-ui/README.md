# Client UI kit

Recreation of `apps/client-ui` (Angular 21 + SpartanNG + Tailwind v4) from https://github.com/seankcheema/trading-season.

Screens (switch via the flow; last route persists in `localStorage['ts-client-route']`):
- **Landing** (`Landing.jsx`) — hero "Ride the market.", hairline texture, glowing cyan draw-in graph. Source: `landing/landing.component.*`
- **Login / Register** (`AuthScreens.jsx`) — lockup fixed top-left, 10px-radius card. Source: `login/`, `register/`
- **Dashboard** (`Dashboard.jsx`) — header dropdowns (market clock, account, profile); left: net-worth card, recent transactions; right: "Search for a stock" (lg), portfolio chart, Assets | Watch List tabs. The watch list is stored in `localStorage['ts-watchlist']` and toggled with the star in New Order. Source: `dashboard/dashboard.component.*`
- **Tour** (`Tour.jsx`, *proposed*) — 7-step first-run spotlight tour: welcome → search → net worth → accounts → portfolio chart → assets/watch list → "Find a stock". Auto-opens until finished or skipped (`localStorage['ts-tour-done']`), resumes at the saved step, restart from profile menu → Take the tour. ←/→ and Esc work.
- **Dialogs** (`Dialogs.jsx`) — New Order (two-column, chart + ticket), Deposit/Withdraw, Settings. Source: `order-submission/`, `accounts/cash-transaction-dialog`, `settings-dialog/`

Shared with other kits: `../_shared/AppHeader.jsx`, `../_shared/OrderTicket.jsx`, `../_shared/market-data.js`.

The "Full view" button in New Order is a **new** affordance linking to the Instrument view kit; it does not exist in the product yet.

## Layouts
Profile menu → **Flat layout / Card layout** (or `?layout=flat`, saved in `localStorage['ts-client-layout']`):
- **Cards** — the product's bento dashboard (`Dashboard.jsx`).
- **Flat** (`DashboardFlat.jsx`, *proposed*) — no card containers. Main column of hairline-separated sections: net-worth hero (48px) with allocation + Deposit/Withdraw on the right, search, portfolio chart, then Assets | Watch List as underlined 18px tabs. Recent Transactions is a full-height right rail divided by a vertical rule. The tour targets work in both.
