# Client UI

Angular 21 single-page app with standalone components, signals, reactive forms, and OnPush change detection. Server-side rendering runs through the Angular SSR server.

| Route | Guard | Screen |
| --- | --- | --- |
| `/` | none | Landing page |
| `/login`, `/register` | guests only | Sign in and registration |
| `/dashboard` | signed in | Accounts, holdings, portfolio history, watchlist, market ticker, order dialog, recent transactions, [first-run tour](#first-run-tour) |
| `/dashboard/markets/:symbol` | signed in | Full-screen instrument page: chart modes and indicators, account and simulation-time controls, order ticket, recent orders |

The market page places the account selector beside the simulation-time control. Its right panel matches the chart column's height on desktop and scrolls internally. Trading is the default tab, with Available Cash and Portfolio Value above Order Execution; Recent Orders and Outlook share that panel. Outlook is the week-ahead risk card for the instrument: whether the next five trading days look stormier or calmer than usual for that stock, read from the static `public/forecast/platform-signals.json` the stock forecast pipeline writes (see [its README](../holdings-and-trade-service/stock-forecast/README.md)). The card shows the platform model's call only where the model's own track record on that stock, counted over windows closed by the simulated date, beats the rule that next week repeats last week; otherwise it shows the rule's call and says so. It reads the simulated clock, never the real date, and states that it is a read on how much the stock may move, never a recommendation. Compact cash and portfolio cards sit above the order ticket. The Buy/Sell action sits at the bottom, with flexible space after the estimated cost or proceeds. The account and simulation-time dropdowns and the profile button are 46px tall and vertically centered beside the search field and back button. Switching tabs preserves the order draft. Smaller screens stack the chart and tools.

Live prices, candles, and the tick stream come from the Java market API. Metrics on the market page are demo data. Users are signed out after a period of inactivity, 10 minutes by default and configurable in settings.

A user who has not accepted the platform terms in force sees them on the dashboard and on the market page in a dialog that cannot be dismissed, with everything behind it inert. They sign by typing their name and accept, or sign out. The wording and its version are in [terms-content.ts](src/app/dashboard/terms/terms-content.ts); the version must match the one [Holdings and Trade Service](../holdings-and-trade-service/README.md) and [Order and Sell Service](../order-and-sell-service/README.md) have in force, which a test in each of them checks. After changing the wording, run `npm --prefix apps/client-ui run terms:pdf` to regenerate [the PDF](../../docs/pdf/terms-and-conditions.pdf) from it.

## First-run tour

The dashboard opens a short spotlight tour the first time it loads in a browser, once the accounts and profile have arrived and no terms are waiting to be accepted. It covers seven steps: a welcome, then the stock search, net worth, the account menu, the portfolio chart, and Assets and Watch List, ending with a button that focuses the search. Each step dims the page around one element and explains it in a card beside it, and the dashboard is inert while the tour is open. Esc or Skip closes it, and the arrow keys move between steps. Profile menu, then Take the tour, starts it again.

The tour remembers per browser, not per user, whether it was finished or skipped (`ts.tour.done`) and the step to resume at after a reload (`ts.tour.step`). Steps find their elements by `data-tour` attributes in [dashboard.component.html](src/app/dashboard/dashboard.component.html). The steps and their copy are in [dashboard-tour.component.ts](src/app/dashboard/tour/dashboard-tour.component.ts). The design follows the tour in the TradingSeason design system.

## Architecture

```mermaid
flowchart TB
    subgraph Routes
        Landing
        Login
        Register
        Dashboard
        MarketPage["Market page"]
    end
    subgraph Core["core/auth"]
        Guard["authGuard / guestGuard"]
        Interceptor["authInterceptor"]
        AuthSvc["AuthService"]
        Storage["TokenStorageService"]
        Lockout["LoginLockoutService"]
        Timeout["SessionTimeoutService"]
    end
    subgraph Feature["dashboard/"]
        Accounts["account-store, portfolio-history"]
        Orders["OrderService"]
        Watch["watchlist-store"]
        Market["MarketDataService"]
        Shared["shared components:<br/>price-chart, trade-ticket,<br/>instrument-search, account and clock controls"]
    end
    Lib["shared-ui-components<br/>(Hlm components)"]

    Login --> AuthSvc
    Register --> AuthSvc
    Dashboard --> Feature
    MarketPage --> Feature
    Routes --> Guard
    Guard --> Storage
    AuthSvc --> Storage
    Interceptor --> AuthSvc
    Timeout --> AuthSvc
    Feature --> Interceptor
    Routes --> Lib
```

### Request routing

```mermaid
flowchart LR
    Browser -- "/auth" --> Proxy["dev proxy, Nginx or CloudFront"]
    Browser -- "/api" --> Proxy
    Proxy -- "/auth: login, register, refresh, logout" --> Auth["Auth Service :3001"]
    Proxy -- "/api/orders, /api/instruments" --> OS["Order and Sell :8081"]
    Proxy -- "everything else under /api" --> HT["Holdings and Trade :8082"]
```

The split is configured twice: [proxy.conf.json](proxy.conf.json) for `ng serve` and [nginx.conf](nginx.conf) for the local container image. Add a new backend path to both. The auth service is reached through the same proxy on `/auth`, so every call is same origin and needs no CORS entry. A deployment on S3 must route the same paths; see [Static UIs on S3](../../infrastructure/README.md#static-uis-on-s3).

### Token renewal

```mermaid
sequenceDiagram
    participant C as Component
    participant I as authInterceptor
    participant A as AuthService
    participant API as /api
    participant Auth as Auth Service

    C->>I: HTTP request to /api
    I->>A: ensureValidSession()
    opt Access token expired
        A->>Auth: POST /auth/refresh
        Auth-->>A: New tokens
    end
    I->>API: Request with Bearer token
    alt 401
        I->>A: ensureValidSession(token)
        A->>Auth: POST /auth/refresh
        I->>API: Retry once
    end
    API-->>C: Response
    Note over I,A: No session, or refresh rejected: navigate to /login
```

Network and refresh-service failures keep the credentials so the request can be retried; sign-out happens on explicit logout, inactivity, or missing or rejected refresh credentials.

### Selected account

The account chosen in the header is never part of a URL, where it would reach browser history, server logs and shared links. [AccountStore](src/app/dashboard/accounts/account-store.service.ts) holds it for the dashboard and the market page, and keeps it in this tab's `sessionStorage` under `ts.accounts.selected`, so moving between the two pages or reloading keeps it, and a new tab starts on the first account. Sign-out forgets it, and a saved id that is not one of the user's accounts selects the first one. Links made before this carried `?accountId=`; [dropAccountIdGuard](src/app/core/drop-account-id.guard.ts) opens them without it.

## Loading states

Recent activity rows show order details and plain-text status beneath the transaction label, with the timestamp beneath the amount. Buy, Sell, Deposit and Withdrawal badges appear immediately to the right of the ticker or transaction label, vertically centered on that line. The dashboard and market page share these rows.

The Recent Transactions dialog names the account each order was placed in (cash transfers show "All accounts", since cash is shared) and marks limit, stop and stop-limit orders beneath the type. Its filter panel narrows by type, status, order kind (market, limit, stop, stop-limit) and account; choosing an account or an order kind leaves out cash transfers, which belong to no single account and have no order kind.

The View All transactions table reserves a narrow actions column after Value, keeping order menus separate from prices and aligned across rows. Order menus close when clicking outside them or opening another order's menu.

While data is on its way, the part of the screen that waits for it shows placeholders in the shape of what is coming: pulsing blocks where the figures, rows and charts will be. A figure is not shown as zero, and a list is not shown as empty, until the answer says so.

| Screen | Placeholder | Shown until |
| --- | --- | --- |
| Dashboard | Net worth, allocation and the invested and cash line; the portfolio card; the account menu's label and its accounts; rows of the assets table | The accounts, holdings and cash arrive |
| Dashboard | Rows of Recent Transactions | The orders and the accounts arrive |
| Dashboard | The portfolio chart | The portfolio history of the chosen range arrives |
| Dashboard | Rows of the watch list | The watch list arrives |
| Order dialog | A chart placeholder in a stable chart area; loading, empty and error states keep the same space | The selected instrument's candles arrive |
| Transactions dialog | Rows of the table, when there is nothing to list yet | The full cash ledger arrives |
| Market page | The whole page: summary, chart panel and tools column | The market snapshot arrives |
| Market page | The chart, and each chart of a comparison | Its candles arrive |
| Market page | Available cash, portfolio value, the account menu and the account named above Recent Orders | The accounts arrive |
| Market page | Rows of Recent Orders | The orders and the accounts arrive |
| Market page | The Outlook card | The signal file arrives |

A placeholder is the `skeleton` class in [src/styles.css](src/styles.css), sized with utilities; a list row has its own in [activity-row.component.ts](src/app/dashboard/shared/activity-row.component.ts). The blocks are hidden from assistive technology, and a visually hidden status beside them says what is loading, so a screen reader hears "Loading accounts" as before. The pulse stops under `prefers-reduced-motion`. A load that fails shows its error and retry in place of the placeholder, and a refresh of data already on screen leaves it there. The [Reporting UI](../reporting-ui/README.md#design-system) declares the same class; keep the two alike.

## Themes

The app comes in the design system's dark theme, which is the default, and a light one. The switch is the sun or moon button in the header of the landing page, the dashboard and the market page, and at the top right of the sign-in and registration pages.

| Piece | What it does |
| --- | --- |
| [src/styles.css](src/styles.css) | The light tokens on `:root`, the dark ones on `:root.dark`. Light keeps the brand's ink and cyan but deepens each color used as text, primary, gain, loss and pending, until it reads at 4.5:1 on a white card. Besides the SpartanNG tokens there are tokens for the hero card, the surfaces the trading charts float, and the chart indicators |
| [ThemeService](src/app/core/theme/theme.service.ts) | Adds or removes the `dark` class on `<html>`, keeps the choice in this browser's `localStorage` under `ts.settings.theme`, and follows a choice made in another open tab. On the server it changes nothing but the class |
| [ThemeToggleComponent](src/app/core/theme/theme-toggle.component.ts) | The switch. Its label names the theme a click gives |
| [src/index.html](src/index.html) | Ships `class="dark"` and a script that removes it when light was saved, before the first paint, so a reload or a prerendered page does not flash dark |

Use a token, not a literal color, in new markup: a literal looks right in one theme only. The [Reporting UI](../reporting-ui/README.md#theme) declares the same values and has its own switch; the choice is kept per origin, so each app remembers its own.

## Commands

client-ui is an independent npm project with its own lockfile. From the repository root:

```sh
npm --prefix apps/client-ui ci
npm --prefix apps/client-ui start
npm --prefix apps/client-ui run build
npm --prefix apps/client-ui test -- --no-watch
npm --prefix apps/client-ui run e2e
```

`ng serve` runs on port 4200 and proxies `/api` as above. Use `--no-watch` for Angular tests; Vitest's `--run` is not supported by the builder.

The [Dockerfile](Dockerfile) builds the app and serves it through unprivileged Nginx, with SPA fallback and the `/api` and `/auth` proxies. It is the local stand-in for S3 behind CloudFront, used by Local Compose only (Jenkins builds no UI image), not the deployable artifact: deploy `dist/client-ui/browser` to S3 as [Static UIs on S3](../../infrastructure/README.md#static-uis-on-s3) describes.

## Tests

- **Unit**: `*.spec.ts` beside the code under `src`, on the Angular unit-test builder with Vitest. The run fails below 90 percent on statements, branches, functions, or lines (`coverageThresholds` in [angular.json](angular.json)). Add `--coverage` for the report. [vitest.config.ts](vitest.config.ts) uses Vitest 4's `maxWorkers: 1` and disables file parallelism to limit contention with the other Jenkins suites.
- **End-to-end**: Playwright in [e2e](e2e), excluded from the unit-test builder. Install the browser once with `npx --prefix apps/client-ui playwright install chromium`; the suite builds the app and serves it on port 4200 (or reuses a server already there). The auth service and Java backend are replaced by an in-memory [API stand-in](e2e/fixtures/api-stub.ts), so no database or backend is needed. The [test fixtures](e2e/fixtures/test.ts) mark the first-run tour as finished so it does not cover the dashboard; a test of the tour sets `tourDone: false`. Update the stand-in whenever an auth, account, cash, order, or terms contract changes.

## Shared components

[shared-ui-components](shared-ui-components/README.md) holds the Spartan/Tailwind component library compiled into this app. Only this app consumes it.

## Removing a portfolio account

The three-dot button in the portfolio dropdown opens account settings. Delete Account is the red shared button on the left. It opens a confirmation explaining that the account is archived and its history retained for reporting. Requirements are checked before enabling Delete, and the backend rechecks them atomically. An unmet requirement is displayed next to the action; submission errors retain the confirmation so the user can retry.

Successful deletion refreshes accounts, shared cash, and transactions and selects an available active account. Archived accounts disappear from the client's portfolio selector and active balances. There is no client history section for archived accounts. See the [lifecycle contract](../holdings-and-trade-service/api.md).

## Trading preferences and execution types

Settings > Trading Preferences saves a user-wide 0-10% execution buffer, defaulting to 1%, through the [profile API](../holdings-and-trade-service/api.md#trading-preferences). Both order tickets share the account-style rounded order-type dropdown, initially showing Market. The shares card contains only quantity and its slider. The summary price row shows the market quote for Market orders, an editable price for Limit or Stop orders, and side-by-side Stop and Limit inputs for Stop-Limit orders. The price row keeps a fixed height across order types. The order modal sizes to its ticket content, with a viewport height cap, internal scrolling and opacity-only entrance animation. Preference and chart loading do not reposition the ticket or its submit button. In Edit Order, the graph expands into the removed search bar's space. Editable prices have an external dollar sign, larger text, and an empty-field highlight, with accessible labels. Buffer and reservation calculations remain internal to the ticket without extra helper text. Market uses the submission quote and Stop uses its first triggering quote with the saved buffer; Limit and Stop-Limit respect explicit limits. The server captures its own submission quote. Order placement and later fills use success toasts for all execution types. Recent activity and transaction history display entered conditional prices (both Stop and Limit for Stop-Limit), retaining actual prices for fills. Open orders offer a three-dot menu beside the amount or price, spanning the transaction row height, with Edit order reopening the stock ticket and Cancel order using centered confirmation. Edits prefill the original quantity/type/prices and retain the account, stock and side; saving atomically replaces the order. Accepted/Open status uses blue styling. These actions are available in recent activity and transaction history. Open orders expire at their submission simulation day's Chicago market close. Expired orders appear as Cancelled in recent activity without an expiry suffix or explanation. Buying power and sellable shares exclude reservations; valuations retain total balances.

Market chart indicators start at the first available candle, using available history until their full period is reached. SMA, EMA and Bollinger Bands use up to 20 candles; RSI uses up to 14 price changes and starts at a neutral 50. Latest appears at the top right beside enabled indicator labels when the chart is away from the latest bars, including both comparison charts.

Each comparison chart places its ticker, price, USD dollar change, signed percentage change, chart controls and Latest in one header row above the plot, wrapping only when space requires it. Comparison mode hides the active indicator badges while keeping their chart overlays and RSI enabled.
