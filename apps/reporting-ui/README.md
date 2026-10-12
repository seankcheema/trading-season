# Reporting UI

Angular 21 single-page app for the analysts who read the scheduled reports and the admins who also watch platform activity and support customers. It presents what the [Reporting Service](../reporting-service/README.md) serves: activity, customers and orders read from the trading database, and the report runs the reporting consumer builds from the `trade-events` Kafka topic. Standalone components, signals, reactive forms, and OnPush change detection, with no server-side rendering.

- Port 4300, for both `ng serve` and the Compose container
- For analysts and admins only. It signs in against the [Auth Service](../auth-service/README.md) and admits an account only if its token carries the `ANALYST` or `ADMIN` [role](../auth-service/README.md#roles). An admin sees every screen; an analyst sees the report runs and nothing else. It has no registration screen. In development, sign in as `reporting-admin@example.com` / `admin123` or `analyst@example.com` / `analyst123`.
- Read only. Nothing in it changes an account or an order.

| Route | Open to | Screen |
| --- | --- | --- |
| `/login` | anyone not signed in as an analyst or admin | Sign in |
| `/` | admin | Activity: a range toggle, five headline figures against the prior period, notional traded over time, orders by status, activity by client segment, the newest events, most traded symbols |
| `/customers` | admin | Customers: every trader with status, accounts, cash, portfolio, failed sign-ins and last activity; search and filters. Analysts and admins are not customers and are not listed |
| `/customers/:userId` | admin | One customer: profile, sign-in security, balances, and their orders and cash transfers, with the same search and filters as Orders |
| `/orders` | admin | Orders: every order, and the deposits and withdrawals among them, with search and filters; an order's row opens the order with its execution, ledger impact, audit trail and references |
| `/runs` | analyst, admin | Report runs: the runs on disk and the PNG charts of the selected run, with download: traded value by symbol, trades per day, traded value by client segment, orders per account |

An analyst who asks for an admin's screen, by a link or by signing in, is taken to `/runs`, and the sidebar offers an analyst only that entry.

Every figure on screen comes from the Reporting Service. Nothing is demo data. Times are shown in the viewer's time zone, and a range such as Today is the viewer's own day. The days inside a report run are UTC days, as the report job buckets them.

Activity opens on the last seven days. The range chosen there is kept in this browser's `localStorage`, so leaving for another screen, reloading or signing in again comes back to it; a browser that refuses storage opens on seven days each time.

## Business requirements covered

The reporting requirements of the LEAP business requirements specification, and where each is met:

| Requirement | Where |
| --- | --- |
| BR-16, by instrument | Most traded on Activity; traded value by symbol in a report run |
| BR-16, by period | The Today, 7D, 30D and 90D ranges on Activity, each figure against the period before; trades per day in a report run |
| BR-16, by client segment | Client segments on Activity; traded value by client segment in a report run. A segment is a trader's level, the only classification of clients the product keeps |
| BR-16, without competing with live trading | The report runs are built from the `trade-events` topic and read the database only for names and trader levels. Activity, Customers and Orders read the trading database, read only; see [Known limitations](#known-limitations) |
| BR-17, trading volumes, most active instruments, client activity trends | On Activity: Notional traded, Most traded, and Active traders against the prior period beside Client segments |
| Section 9.3, internal access limited to what a role requires | An analyst sees the report runs only; the screens that show individual customers are an admin's. See [Who sees what](#who-sees-what) |

## How the data reaches the screen

```mermaid
flowchart LR
    OS["Order and Sell Service"] -- "order status changes" --> K[["Kafka trade-events"]]
    K -- "group reporting-ingester" --> C["Reporting consumer<br/>events files, scheduled report run"]
    C --> F[("reporting_files<br/>report.json and PNG charts")]
    F --> RS["Reporting Service :8083"]
    DB[("trading_season<br/>orders, fills, cash, locks, audit trail")] -. "read only" .-> RS
    RS -- "/api/reporting" --> UI["Reporting UI :4300"]
```

The UI never talks to Kafka or the database. Two kinds of data reach it, both through the Reporting Service:

| Screen | Source | Endpoint | Kept fresh by |
| --- | --- | --- | --- |
| Activity | Database | `GET /api/reporting/activity?range=&tzOffset=` | Reading again every 15 seconds, and when the range changes |
| Customers | Database | `GET /api/reporting/customers` | Reading again every 30 seconds |
| One customer, with their orders and transfers | Database | `GET /api/reporting/customers/{userId}` | Reading again every 30 seconds |
| Orders and cash transfers | Database | `GET /api/reporting/orders` | Reading again every 30 seconds |
| One order | Database | `GET /api/reporting/orders/{orderId}` | Read when the order is opened |
| Report runs | `trade-events` files | `GET /api/reporting/runs`, `GET /api/reporting/runs/latest`, `GET /api/reporting/scheduler/status` | Asking the scheduler status every 30 seconds and reloading when the latest run id changes |
| Chart images of a run | `trade-events` files | `GET /api/reporting/runs/{runId}/files/{name}`, fetched as a blob because an image tag cannot send the bearer token | Loaded with the run |
| Signed-in user's name and trader level | Database | `GET /api/reporting/profile`; a sign-in without a trading profile (404) shows its email instead | Read once |

A refresh that fails leaves the last good data on screen. The database screens show orders whether or not a Kafka broker was running when they were placed; the report runs show only orders placed while one was.

## Architecture

```mermaid
flowchart TB
    subgraph Routes
        Login
        Shell["Shell<br/>collapsible sidebar, signed-in user"]
        Activity
        Customers["Customers,<br/>customer detail"]
        Orders["Orders,<br/>order detail dialog"]
        Runs["Report runs"]
    end
    subgraph Shared["shared/"]
        Kit["change pill, range toggle, export menu,<br/>filter select, line chart, sparkline, dialog"]
        Live["live()<br/>load, reload on an interval"]
    end
    subgraph Core["core/auth"]
        Guard["authGuard / adminGuard / guestGuard"]
        Interceptor["authInterceptor"]
        AuthSvc["AuthService"]
        Storage["TokenStorageService"]
    end
    subgraph Reporting["reporting/"]
        Store["ReportStore<br/>report runs, scheduler status, profile"]
        Api["ReportingApiService"]
    end

    Login --> AuthSvc
    Shell --> Activity
    Shell --> Customers
    Shell --> Orders
    Shell --> Runs
    Shell --> Store
    Activity --> Live
    Customers --> Live
    Orders --> Live
    Activity --> Kit
    Customers --> Kit
    Orders --> Kit
    Runs --> Store
    Live --> Api
    Store --> Api
    Api --> Interceptor
    Interceptor --> AuthSvc
    AuthSvc --> Storage
    Routes --> Guard
    Guard --> AuthSvc
```

`ReportStore` is provided by the shell component, so it exists only while a signed-in screen is shown and its polling stops on sign-out. Each database screen owns its data through `live()`, which stops with the screen.

### Request routing

```mermaid
flowchart LR
    Browser -- "/api/reporting" --> Proxy["dev proxy or Nginx"]
    Browser -- "/auth" --> Proxy
    Proxy -- "/api/reporting" --> RS["Reporting Service :8083"]
    Proxy -- "/auth" --> Auth["Auth Service :3001"]
```

Both backends are called on the UI's own origin, so neither needs a CORS entry for port 4300. The split is configured twice: [proxy.conf.json](proxy.conf.json) for `ng serve` and [nginx.conf](nginx.conf) for the container image. Add a new backend path to both. This differs from the Client UI, which calls the Auth Service directly.

Token handling matches the Client UI: the interceptor adds the bearer token to `/api/reporting` calls, refreshes an expired access token through `POST /auth/refresh`, retries once after a 401, and sends the user to `/login` when the refresh token is missing or rejected. The session is kept in `localStorage` under its own key, separate from the Client UI's because the two apps are different origins.

### Who sees what

The Reporting Service is what enforces the rules: it answers 403 on the run endpoints to a token with neither the `ANALYST` nor the `ADMIN` role, and on the console endpoints (activity, customers, orders) to a token without `ADMIN`. The UI checks the same claim so that nobody gets a screen that could only show errors:

| Moment | An account that is neither an analyst nor an admin | An analyst |
| --- | --- | --- |
| Sign-in | The credentials are accepted by the Auth Service, the UI revokes that session at once, keeps no token, and says the account has no access to reporting | Signed in and taken to Report runs |
| Opening a screen with a stored session | `authGuard` signs it out and returns to `/login` with the same message | `adminGuard` takes it from Activity, Customers or Orders to Report runs |
| A 403 from the Reporting Service, for example after a refresh issued a token for a changed role | The interceptor signs it out and returns to `/login` with the same message | The same: the guards keep an analyst off the console, so a 403 means the role changed |

A role change takes effect at the account's next sign-in or token refresh. See [roles](../auth-service/README.md#roles) for how an account becomes an analyst or an admin.

## Design system

The screens reproduce the TradingSeason design system's reporting console: the sidebar shell, Activity, Customers, the customer page, Orders and the order dialog, with the kit's layout, spacing, type and copy. The design system export itself is not checked in.

The tokens are declared in [src/styles.css](src/styles.css) with the same values as the Client UI's dark theme, and Tailwind v4 maps them to utilities. Text takes the font's own line height, as the kit does. The kit's components are ported once, in [src/app/shared](src/app/shared):

| Kit component | Here |
| --- | --- |
| ChangePill, status tags | [change-pill.component.ts](src/app/shared/change-pill.component.ts) |
| TimeframeToggle | [timeframe-toggle.component.ts](src/app/shared/timeframe-toggle.component.ts) |
| HeaderDropdown with the export menu | [export-menu.component.ts](src/app/shared/export-menu.component.ts): CSV of the rows on screen, or PDF through the print dialog |
| Select with a caption | [filter-select.component.ts](src/app/shared/filter-select.component.ts) |
| PriceChart | [line-chart.component.ts](src/app/shared/line-chart.component.ts) |
| Sparkline | [sparkline.component.ts](src/app/shared/sparkline.component.ts) |
| Dialog | [dialog.component.ts](src/app/shared/dialog.component.ts) |
| Orders table with its search and filter row | [order-table.component.ts](src/app/orders/order-table.component.ts) inside [order-browser.component.ts](src/app/orders/order-browser.component.ts), shared by Orders and the customer page |
| DashCard, DashLabel, DashLink, Button, Input, table head and rows | Classes in [src/styles.css](src/styles.css): `dash-card`, `net-worth-card`, `dash-label`, `dash-link`, `ghost-button`, `ds-control`, `dash-table-head`, `row-button` |

From 1024px wide a screen fills the window and its lists scroll inside their cards, with a bottom fade and no scrollbar, as the kit draws it. From 1280px wide Activity does so down to a window 616px high, so it fits a short wide display such as 1920x828 with the browser's own bars: its chart row, with the chart and the two splits side by side, takes four ninths of the room under the headline figures and never less than the four statuses need, and the two lists take the rest. Between 1024px and 1279px the two splits stack beside the chart so that it keeps its width, and the screen fills a window from 1032px high. Narrower, or on a shorter window, the page scrolls.

From 768px wide the sidebar stands beside the screen and can be collapsed to 60px with the button beside the logo: the logo mark, the navigation icons, the button itself and log out stay, and the names remain as tooltips and for assistive technology. The choice is kept in this browser's `localStorage`. Narrower, the sidebar is a bar across the top and does not collapse.

The kit is a proposal drawn on sample data. Where the product has no such data, or the screen must stay read only, the app departs from it:

| Kit | Here | Why |
| --- | --- | --- |
| "Unlock now" on a locked customer, "Email customer" | Left out; the lock banner says when the account unlocks | Reporting only reads |
| Statuses FILLED, PENDING, REJECTED, CANCELLED, and customer status SUSPENDED | FILLED, PENDING, ACCEPTED, REJECTED; ACTIVE and LOCKED | These are the statuses the product has |
| Order execution: bid and ask at submit, spread, market price now, session | Indicative price, price buffer, slippage, submitted, resolved, market time | The quote an order executed against is not kept in the database |
| The orders table has a Type column | An Amount column in its place: shares at the fill price | Every order is a market order, so the column said the same on every row |
| The orders table lists orders only | Deposits and withdrawals are rows among the orders: asset Cash, side Deposit or Withdrawal, status Completed, the cash moved under Amount, no order number and nothing to open | A customer's cash movements belong beside their orders when supporting them |
| The order dialog puts References last in the left column, the client reference cut to its cell | References sits under the audit trail, with the client reference shown whole on a row of its own and a copy button | On a short window the references were below the fold, and a cut reference cannot be read or selected |
| The customers screen has a Role filter | No Role filter, and no analysts or admins in the list | Staff are not customers, so every row is a trader |
| The chart's value axis divides the range between the lowest and highest value into four | It rounds to steps of 1, 2, 2.5 or 5 times a power of ten, from zero for notional traded, and a flat series has one label | The even division read $75,542, $56,657, and on a day without a trade ran below zero and out of the card |
| The sidebar is fixed at 232px | It collapses to its icons | Asked for, to give the screens the width |
| "Streaming" beside Live activity | "Live" | The feed is read again every 15 seconds, not streamed |
| Activity opens on Today | It opens on 7D, and afterwards on the range last chosen in this browser | Asked for: Today is mostly zeros until the day's first order |
| The chart row holds Notional traded and Orders by status | A third card, Client segments: each trader level's notional and its share, traders and orders in the range | The business requirements ask for activity by client segment, which the kit predates |
| Three sidebar entries | A fourth, Report runs, and for an analyst only that one | The scheduled reports built from the Kafka topic are a product requirement the kit predates |
| No way to sign out | A log out button beside the signed-in user | The kit does not draw one |
| Most traded shows a price sparkline under "Today" whatever the range | The column is named after the chosen range and plots the symbol's fill prices in it | The label follows what is plotted |

The chart images on the Report runs screen are drawn by the Reporting Service, in the same surface and colors.

This app does not use the Client UI's [shared-ui-components](../client-ui/shared-ui-components/README.md). Its own markup is styled directly from the tokens, so that library still has one consumer.

## Commands

reporting-ui is an independent npm project with its own lockfile. From the repository root:

```sh
npm --prefix apps/reporting-ui ci
npm --prefix apps/reporting-ui start
npm --prefix apps/reporting-ui run build
npm --prefix apps/reporting-ui test -- --no-watch
```

`ng serve` runs on port 4300 and expects the Auth Service on `localhost:3001` and the Reporting Service on `localhost:8083`; [scripts/start-local.ps1](../../scripts/start-local.ps1) starts all three, see [Local processes](../../README.md#local-processes-windows). Use `--no-watch` for the tests; Vitest's `--run` is not supported by the builder.

What the screens show depends on what is running:

| Situation | Activity, Customers and Orders | Report runs |
| --- | --- | --- |
| Reporting Service not reachable | A load error with a retry | A load error with a retry |
| Reporting Service up, consumer never started | Everything in the database | "No report runs yet" |
| Consumer running, no trade event stored yet | Everything in the database | A report of zeros |
| Orders placed while the broker and consumer run | Everything in the database | Those orders, from the next run on |

Trade events exist only for orders placed while a Kafka broker is running. Orders already in the database are never replayed into the report runs.

The production [Dockerfile](Dockerfile) builds the app and serves it through unprivileged Nginx, with SPA fallback and the two proxies. In [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) the container starts after `reporting-service` and `auth-service`, because Nginx resolves both upstream names when it starts.

## Tests

`*.spec.ts` beside the code under `src`, on the Angular unit-test builder with Vitest. The run fails below 90 percent on statements, branches, functions, or lines (`coverageThresholds` in [angular.json](angular.json)). Add `--coverage` for the report. Shared test data and DOM helpers live in [src/testing](src/testing) and are excluded from the application build. There is no end-to-end suite for this app.

## Known limitations

- The Orders screen shows the newest 500 orders and the newest 500 transfers; the count beside the filters is of those rows. A customer's page shows their newest 1000 of each.
- A figure on Activity has no change pill when the period before the range has nothing to compare with. Today is mostly zeros until the day's first order.
- A client segment is the level a trader holds now. The level a trader held when an order was placed is not kept, so a promoted trader takes their earlier orders into the new segment.
- Activity, Customers and Orders read the trading database that live trading writes to. They only read, and each open screen asks every 15 or 30 seconds, but only the report runs are independent of the live trading path.
- An analyst's "Orders per account" chart names each account and its trader. Whether an analyst's work needs clients by name is a decision for the business; the other three charts name nobody.
- A transfer row opens nothing: the service has no endpoint for a single cash transaction.
- The Activity ranges are fixed at today, 7, 30 and 90 days.
- The service keeps only the newest report run, so the run list normally has one entry, and a run covers every event on disk.
- Users are not signed out for inactivity, unlike the Client UI.
