# Client UI

Angular 21 single-page app with standalone components, signals, reactive forms, and OnPush change detection. Server-side rendering runs through the Angular SSR server.

| Route | Guard | Screen |
| --- | --- | --- |
| `/` | none | Landing page |
| `/login`, `/register` | guests only | Sign in and registration |
| `/dashboard` | signed in | Accounts, holdings, portfolio history, watchlist, market ticker, order dialog, recent transactions, [first-run tour](#first-run-tour) |
| `/dashboard/markets/:symbol` | signed in | Full-screen instrument page: chart modes and indicators, account and simulation-time controls, order ticket, recent orders |

Hover details on the market page charts, the order ticket chart and the dashboard portfolio chart sit at the top of the plot, centered above the hovered point, so they do not move vertically. When the hovered point is high enough that the label would cover it, the label moves beside the point, still along the top.

The market page places the account selector beside the simulation-time control. Its right panel matches the chart column's height on desktop and scrolls internally. Trading is the default tab, with Available Cash and Portfolio Value above Order Execution; Recent Orders shares that panel. Compact cash and portfolio cards sit above the order ticket. The Buy/Sell action sits at the bottom, with flexible space after the estimated cost or proceeds. The account and simulation-time dropdowns and the profile button are 36px tall and vertically centered beside the search field and back button. Switching tabs preserves the order draft. Smaller screens stack the chart and tools. The lightning Live tailing toggle in a separate button beside the chart navigation bar enables live tailing for both charts: it jumps to the latest bars and follows incoming updates while preserving zoom. It starts enabled. Panning back with the arrow controls, dragging, or horizontal scrolling turns it off automatically for both charts. Turning it off keeps the current window while prices continue updating; enable it again to resume following the latest bars.

Live prices, candles, and the tick stream come from the Java market API. Supplementary metrics on the market page are demo data. Users are signed out after a period of inactivity, 10 minutes by default and configurable in settings.

A user who has not accepted the platform terms in force sees them on the dashboard and on the market page in a dialog that cannot be dismissed, with everything behind it inert. They sign by typing their name and accept, or sign out. The wording and its version are in [terms-content.ts](src/app/dashboard/terms/terms-content.ts); the version must match the one [Holdings and Trade Service](../holdings-and-trade-service/README.md) and [Order and Sell Service](../order-and-sell-service/README.md) have in force, which a test in each of them checks. After changing the wording, run `npm --prefix apps/client-ui run terms:pdf` to regenerate [the PDF](../../docs/pdf/terms-and-conditions.pdf) from it. The terms' version is the date of their wording (`TERMS_VERSION` in `dashboard/terms/terms-content.ts`, which must equal `UserService.CURRENT_TERMS_VERSION` in Holdings and Trade); version 2026-10-21 added the section on model reads and trade signals, so every user accepts again.

## Dua insights

Dua is a fixed 52px shark launcher at bottom-right on the dashboard and market page, without reserved layout space. The panel starts closed and closes on navigation or a click outside the panel and launcher. Outside clicks keep focus on the clicked control; Escape and the minimize button return focus to the launcher. Its supplied [launcher image](public/assets/assistant/shark-launcher-light-512.png) is split into a [body layer](public/assets/assistant/shark-launcher-body-512.png) and a separate [fin layer](public/assets/assistant/shark-launcher-fin-512.png), which share one transform. The fin is centered at rest (2.2x scale); hover, keyboard focus, pending notifications and open chat reveal the face (1.35x scale), using a 450ms transition disabled for reduced motion. Hovering the launcher also wiggles the fin a few degrees about its base for 600ms, disabled for reduced motion. The panel hides its scrollbars while it animates between sizes, so none flashes when a choice expands the card. The initial header reads Dua followed by a smaller Free Plan label, vertically centered with it and with no dash or dot between them.

The choice-based assistant uses existing data and factual templates:

- **Volatility outlook** (first, shown as live with a breathing gradient border): the week-ahead read for the open instrument, or the first holding on the dashboard, from the same signal file as the market page's Outlook card. Its teaser line carries the stock, the call in plain words and the leading record's accuracy over the last twenty closed weeks; the card shows the model estimate, the accuracy so far and the usual and recent daily moves, and a button opens the market page with the Outlook tab already selected (`?tab=outlook`, a tab name, never an account id).
- **What's trending** (second, live, with a lightning bolt and the gain-coloured breathing border): the trade signal for the open instrument, or the first holding, from the same trend file as the market page's trade signal card, with its notice, plus a second card listing every covered stock's strong-trend read (higher, lower, or no clear direction), strongest momentum first, with how often its calls were right and how many weeks it called. The button opens the market page's Outlook tab. The market page's trade signal card leads with the same read: "Consider buying" or "Consider selling" only when the stock's last five days moved by more than its usual swings, and "No clear direction" otherwise. Its record counts its last twenty closed calls and always says how many weeks they took. The model and the momentum pattern sit beside it under Details.
- **Daily review:** illustrative Market Overview (+1.8% S&P 500, Today), Portfolio Impact (+$385, Today), and Tomorrow's Outlook (3 events, Up Next). Explanations clarify that figures and schedules are fictional, not actual market or account data.
- **My holdings:** three static placeholder cards styled like Stock Insights: Portfolio Growth (+12.4%, $2,450, This Month), Sector Concentration (68% technology, Current), and Top Performer (NVIDIA +32.8%, $1,280, This Month). Explanations identify these as examples, not selected-account calculations.
- **This stock:** three illustrative Growth, Valuation and Risk previews using the supplied example figures (+24.8%, -18%, 65%). Every card shows the captured market date; the explanations identify the example data, and the header reads Stock Insights. No history or fundamentals requests are made.

The 360px-wide panel shows one consistent-height card at a time, with three navigation bars for each choice. Cards use a continuous teal/purple result-body gradient without black outer gutters, fading to dark at the bottom, while the header stays black. Large white numbers and directional arrows accompany short, safely interpolated takeaways with key results in bold. Stock-list changes retain signs and green/red colors. Compact lists scroll internally; card content remains accessible on short viewports or enlarged text. A circled question-mark icon opens Explain these numbers at the top right beside the card title; returning from explanations restores the same snapshot. Refresh/retry is an icon beside close, with snapshot time only beside the title. See the [Dua component](src/app/dua/dua.component.ts) and [insight helpers](src/app/dua/dua-insights.ts) for dimensions and calculations.

Existing market and holdings data establish a notification baseline independently of the displayed placeholders. Changes to rounded insight results or the trading date can trigger one red **1** badge, without extra requests. Clicking it opens chat and clears the badge in one click. Further notifications are suppressed across navigation/account changes until a full page refresh. Hover does not acknowledge it. Preserve logout, account/simulation context, terms blocking, loading skeletons and unavailable states. No backend, model, free text, persistent chat history or trading action is added.

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

[AccountStore](src/app/dashboard/accounts/account-store.service.ts) holds the selected account for the dashboard and market page. Navigation between them and stock selection preserve the selected account in the `accountId` query parameter. Each page accepts the requested account only when it belongs to the signed-in user, otherwise falling back to an owned account. Account ids in links do not grant access to another user's accounts.

## Order status

An order's status changes on screen without a refresh (BR-07). While signed in, [OrderService](src/app/dashboard/orders/order.service.ts) holds `GET /api/orders/stream` open and applies each `order-status` event the [Order and Sell Service](../order-and-sell-service/README.md) pushes from Kafka: the order's row moves to `ACCEPTED`, `FILLED`, `REJECTED` or `CANCELLED` the moment the backend commits it, a resolved order releases its reservation, and a fill triggers the same cash and holdings refresh the dashboard already does after a submission. The stream needs the bearer header, which the browser's `EventSource` cannot send, so the service reads it through `fetch` and the same token renewal the HTTP interceptor uses.

A status never moves backwards, so an `ACCEPTED` event arriving after the submission response already said `FILLED` changes nothing. An event for an order the page has not loaded re-reads the order history. If the stream drops, the service reopens it after 2 s, doubling to a 10 s cap, and re-reads the history once on reconnection because the backend replays nothing. The stream closes on sign-out and reopens on the next sign-in. The Nginx image turns proxy buffering off for `/api/orders` so frames are forwarded as they arrive.

The order history behind the dashboard and the market page is read from `GET /api/orders` page by page, in the endpoint's default page size, until a short page arrives (BR-11), so every view that derives cash or holdings from past orders still sees all of them.

A fill that lands after the submission response, such as a limit or stop order's, is announced by the service with the `executionPrice` the Order and Sell Service settled at (BR-08); the submission toasts use the same field and fall back to the indicative price when a response has none.

## Loading states

Recent activity rows show order details and plain-text status beneath the transaction label, with the timestamp beneath the amount. Buy, Sell, Deposit and Withdrawal badges appear immediately to the right of the ticker or transaction label, vertically centered on that line. The dashboard and market page share these rows.

If cash history cannot be loaded, Recent Transactions keeps the available transactions visible without a warning banner. Failed order cancellations show a separate cancellation error.

The Recent Transactions dialog names the account each order was placed in (cash transfers show "All accounts", since cash is shared) and marks limit, stop and stop-limit orders beneath the type. Its filter panel narrows by type, status, order kind (market, limit, stop, stop-limit) and account; choosing an account or an order kind leaves out cash transfers, which belong to no single account and have no order kind.

A From and To date field beside the symbol filter, each opening the browser's calendar, limits the table to those days inclusive, in the browser's time zone (the zone the table's own dates are shown in). Either end can be left empty, and each field stops at the other. The range combines with the filter panel and the symbol filter and is not counted in the filter badge.

The table shows fifteen transactions a page, in a box that keeps the same size whatever the number of transactions. When there is more than a page's worth, Previous and Next buttons with a "Page n of m" label appear centered under the table. The count on the right, aligned with the Value column, says which transactions the page holds out of all of them ("1-15 of 40 transactions", then "16-30 of 40 transactions", and so on); with a single page it is just the total. The list keeps a visible scrollbar on its right, with the header and footer reserving the same width so the columns stay aligned, so a page taller than the box shows that it scrolls. Changing a filter, the symbol, the date range or the sort order returns to page one.

The dialog's Export menu downloads the statement as CSV or PDF, named `account-statement-YYYY-MM-DD`. It exports every row that matches the filters and date range, in the on-screen sort order, across all pages; clear the filters first for the full statement. The control is disabled while the ledger loads and when no rows match. Both formats have Date, Asset, Account, Type, Status, Shares, Price and Value; the CSV adds Order kind, writes ISO dates and plain numbers, and prefixes text that starts with `=`, `+`, `-` or `@` with an apostrophe so a spreadsheet does not run it. Cash withdrawals carry a minus sign and deposits a plus sign. The files are built in the browser by [statement-export.ts](src/app/dashboard/history/statement-export.ts); no backend call is made, and jsPDF loads only when a PDF is requested.

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

Dark is the default. The sun or moon button switches themes from the landing page, dashboard and market page headers, and the top right of sign-in and registration.

[ThemeService](src/app/core/theme/theme.service.ts) switches the `dark` class on `<html>`, saves the choice in `localStorage` under `ts.settings.theme`, and follows changes from other open tabs. [index.html](src/index.html) applies the saved choice before the first paint. If storage is unavailable, switching still works for the current page.

[ThemeToggleComponent](src/app/core/theme/theme-toggle.component.ts) labels the button with the theme it will select. [styles.css](src/styles.css) defines light tokens on `:root` and dark tokens on `:root.dark`, including chart surfaces, indicators and status colors. Use these tokens for theme-aware content. Dua uses theme tokens for its insight gradients, header, metric text, explanations and directional colors; its chat choices and controls follow the shared surface and text tokens. The greeting and review-choice labels use 14px text, with 12px descriptions and padded rows for readability; the same sizing covers Daily Review, My Holdings and This Stock. Their shortened descriptions stay on one line, with an ellipsis when space is limited.

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
- **End-to-end**: Playwright in [e2e](e2e), excluded from the unit-test builder. Install the browser once with `npx --prefix apps/client-ui playwright install chromium`; the suite builds the app and serves it on port 4200 (or reuses a server already there). [playwright-setup.mjs](scripts/playwright-setup.mjs) builds with the Angular CLI directly and starts the production SSR request handler through [playwright-ssr.mjs](scripts/playwright-ssr.mjs). The setup owns a direct Node child, sends shutdown over IPC, waits up to five seconds, then uses bounded direct termination if needed. This avoids Playwright's unbounded Windows process-tree cleanup; normal and failed runs release the test port before writing their final reports. A reused development server is left running, while CI rejects an occupied port. [Lifecycle integration tests](e2e/server-lifecycle.spec.mts) cover active connections, failed startup/builds and forced termination. The auth service and Java backend are replaced by an in-memory [API stand-in](e2e/fixtures/api-stub.ts), so no database or backend is needed. The [test fixtures](e2e/fixtures/test.ts) mark the first-run tour as finished so it does not cover the dashboard; a test of the tour sets `tourDone: false`. Update the stand-in whenever an auth, account, cash, order, or terms contract changes.

## Shared components

[shared-ui-components](shared-ui-components/README.md) holds the Spartan/Tailwind component library compiled into this app. Only this app consumes it.

## Removing a portfolio account

The three-dot button in the portfolio dropdown opens account settings. Delete Account is the red shared button on the left. It opens a confirmation explaining that the account is archived and its history retained for reporting. Requirements are checked before enabling Delete, and the backend rechecks them atomically. An unmet requirement is displayed next to the action; submission errors retain the confirmation so the user can retry.

Successful deletion refreshes accounts, shared cash, and transactions and selects an available active account. Archived accounts disappear from the client's portfolio selector and active balances. There is no client history section for archived accounts. See the [lifecycle contract](../holdings-and-trade-service/api.md).

## Trading preferences and execution types

Settings > Trading Preferences saves a user-wide 0-10% execution buffer, defaulting to 1%, through the [profile API](../holdings-and-trade-service/api.md#trading-preferences). Both order tickets share the account-style rounded order-type dropdown, initially showing Market. The shares card contains only quantity and its slider. The summary price row shows the market quote for Market orders, an editable price for Limit or Stop orders, and side-by-side Stop and Limit inputs for Stop-Limit orders. The price row keeps a fixed height across order types. The order modal sizes to its ticket content, with a viewport height cap, internal scrolling and opacity-only entrance animation. Preference and chart loading do not reposition the ticket or its submit button. In Edit Order, the graph expands into the removed search bar's space. Editable prices have an external dollar sign, larger text, and an empty-field highlight, with accessible labels. Buffer and reservation calculations remain internal to the ticket without extra helper text. Market uses the submission quote and Stop uses its first triggering quote with the saved buffer; Limit and Stop-Limit respect explicit limits. The server captures its own submission quote. Order placement and later fills use success toasts for all execution types. Recent activity and transaction history display entered conditional prices (both Stop and Limit for Stop-Limit), retaining actual prices for fills. Open orders offer a three-dot menu beside the amount or price, spanning the transaction row height, with Edit order reopening the stock ticket and Cancel order using centered confirmation. Edits prefill the original quantity/type/prices and retain the account, stock and side; saving atomically replaces the order. Accepted/Open status uses blue styling. These actions are available in recent activity and transaction history. Open orders expire at their submission simulation day's Chicago market close. Expired orders appear as Cancelled in recent activity without an expiry suffix or explanation. Buying power and sellable shares exclude reservations; valuations retain total balances.

Market chart indicators start at the first available candle, using available history until their full period is reached. SMA, EMA and Bollinger Bands use up to 20 candles; RSI uses up to 14 price changes and starts at a neutral 50. Latest appears at the top right beside enabled indicator labels when the chart is away from the latest bars, including both comparison charts.

Each comparison chart places its ticker, price, USD dollar change, signed percentage change, chart controls and Latest in one header row above the plot, wrapping only when space requires it. Comparison mode hides the active indicator badges while keeping their chart overlays and RSI enabled.



This stock previews use a large percentage, a larger white result headline with emphasized words, with supporting descriptions available from the question-mark icon. Each card shows its position (01 / 03 through 03 / 03) and the captured market date. Direction arrows are large and light green/red; Daily review and My holdings also use illustrative cards, with existing navigation and notification behavior. Revenue, valuation and geographic figures remain illustrative until a real fundamentals source is implemented.

Stock preview metric titles sit above the number in larger white text. The small metadata row shows the captured market date (MM/DD/YYYY) and card count, not a financial reporting date. The header reads Stock Insights; explanations state that figures are illustrative. Reduced card height and bottom padding keep navigation close to the description.

All Daily review, My holdings and stock preview cards share the same label-above-number layout, larger white metric labels, consistent top spacing, and a period-or-date/card-count row. The date is the viewed market context, not a financial reporting date. Card heading and metadata spacing is compact; signed values, directional colors, consistent section heights and internal scrolling are preserved.

The stock section header reads Stock Insights. Stock metric titles have 14px of spacing above them after the date/card-count row. These stock figures remain illustrative, as described in the explanation panel.

My holdings uses the same gradient, metric-first typography, circled explanation action and three-card navigation as Stock Insights. Its metadata row displays This Month or Current rather than a date. Refresh returns to Portfolio Growth. These examples do not derive from selected-account holdings, sector classification or monthly return history; Daily review also uses illustrative placeholders and existing notification behavior is preserved.

Daily review uses the shared three-card illustrative layout with Today/Up Next labels, large metrics, short result headlines with descriptions behind the question-mark icon. The explanation icon states that all figures and events are examples, not actual market data or the selected account's results. No event-calendar or market-news requests are made. Existing pure market/holdings calculations remain available for tests and notification baselines; they do not supply the displayed placeholder cards.

All three insight choices keep supporting gray descriptions off the main cards. The circled question mark opens a card-specific explanation with the same gradient and black header: a short result summary, Why it matters reasoning from the placeholder example, and a compact illustrative-data clarification. Returning restores the same card and snapshot without requests or recalculation.

Insight sections size naturally to their tallest card instead of reserving a fixed 320px. All slides share one grid cell so navigation stays in place as cards change and text wraps responsively. Inactive slides remain invisible, inert and hidden from assistive technology; overflowing content retains scrolling on short viewports or with enlarged text. Compact bottom padding keeps the headline close to navigation.

Question-mark explanation views also use content-driven height, matching insight-card padding and the same viewport height cap. Short explanations have no reserved blank space below their text; long explanations scroll internally when required by viewport size or enlarged text.

Card changes use a 380ms fade/short slide with the same gentle ease-in-out as resizing, and content-view changes ease the measured panel height over 380ms with gentle ease-in-out while remaining anchored above the launcher. Rapid changes continue from the current animated height; reduced-motion preferences disable both effects. The final size remains content-driven and viewport-constrained, with 12px card bottom padding and 12px navigation margins.

Information views use 36px bottom padding so their last paragraph has the same breathing room as the insight content above navigation. Their height remains content-driven and uses the shared resize transition.

Information views use a consistent 14px type scale and 1.55 line height, with semibold headings/emphasis and regular body copy. Opening and returning use a 280ms content entrance and a 380ms height transition. The panel bottom remains anchored 12px above the fixed launcher; resizing changes the top edge only. Reduced-motion preferences disable animation.

Card transitions animate opacity and a small visual translation only; the shared grid row and navigation never change size or position during a card switch. Navigation indicator colors fade over the same 380ms without layout movement. Reduced motion switches cards and indicators immediately.
