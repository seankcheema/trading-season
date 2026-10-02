# Business UI

Angular login, registration, and dashboard screens using reactive forms, standalone components, signals, and the shared UI package. The dashboard market ticker and instrument charts read the Java stock snapshot, OHLCV candle API, and live stream. Selecting a ticker, search result, or holding opens the existing instrument popup; its full-screen action navigates to the protected `/dashboard/markets/:symbol` route. That route uses the dashboard's centered wrapper and a one-viewport desktop trading layout; tablet and mobile layouts stack and scroll. Symbol prices, candles, range volume, and connection state are live. It supports line, area, candlestick, OHLC, volume, and percentage chart modes, plus an optional peer comparison stored in the `compare` query parameter. The chart can calculate SMA 20, EMA 20, Bollinger Bands 20 with two standard deviations, and RSI 14 in the browser from the selected candle range; these display choices are not persisted. RSI shows a labeled deterministic demo series until at least 15 candles are available, then switches to the calculated value. Supported chart ranges are `1D`, `5D`, `1M`, and `1Y`.

The dashboard also creates and renames accounts, shows each account's holdings as its portfolio, and deposits and withdraws the cash all of a user's accounts share, through the implemented endpoints in the [API reference](../../docs/reference/api.md#accounts-and-holdings). The simulation clock controls trade visibility, displayed holdings, shared cash, net worth, and portfolio history. Current funding is the starting budget; only trades rewind. The chart combines share quantities effective at each simulated time with replay prices and shows zero before the first investment. Without a simulation clock, portfolio history uses persisted observations on actual dates; see [the history contract](../../docs/reference/api.md#portfolio-valuation-history). Both financial cards show two decimal places. Net worth is that cash plus every account's portfolio. The full-screen market page reuses the dashboard's account and simulated-time dropdowns and executes Buy/Sell orders through the same OrderService. Its ticket uses actual cash and holdings projected at the simulation cursor; a fill refreshes both, while a failed refresh offers a balance-only retry. The selected account round-trips through the `accountId` query parameter. The Recent Orders tab shows that account's latest 20 orders across all stocks at or before the cursor, including pending and rejected outcomes. Metrics, overview signals, news, and AI responses remain browser-only demo data. Signed-in users are signed out after a configurable period of inactivity, 10 minutes by default; see the [API reference](../../docs/reference/api.md#ui-integration).

From repository root:

```sh
npm ci
npm --workspace business-logic-ui start
npm --workspace business-logic-ui run build
npm --workspace business-logic-ui test -- --no-watch
npm --workspace business-logic-ui run e2e
```

Development runs on port 4200 and proxies `/api` to the Java backend on port 8081. See [routes](src/app/app.routes.ts), [shared components](../../packages/shared-ui-components/README.md), and [development prerequisites](../../docs/guides/development.md). Angular tests take --no-watch rather than Vitest's --run option.

The production container builds this root npm workspace and serves the browser output through unprivileged Nginx on host port 4200. Its Nginx configuration provides SPA fallback and proxies `/api` to the Compose `holdings-and-trade-service`. Build and run it as part of [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml).

## Tests

Unit tests live beside the code they cover as `*.spec.ts` under `src`, and run on the Angular unit-test builder. The run fails below 70% on any coverage counter (statements, branches, functions, or lines); the thresholds are in [angular.json](angular.json).

End-to-end tests live in [e2e](e2e) and run on Playwright, which owns that directory and is excluded from the unit-test builder. They cover authentication, inactivity timeout, account workflows, and the full-screen market journey, including responsive layout, order execution, account/time controls, recent orders, chart controls, and comparison URL state. Install the browser once with `npx playwright install chromium`; the suite builds and starts its own server, or reuses one already on port 4200.

The auth service and Java backend are replaced by [an in-memory stand-in](e2e/fixtures/api-stub.ts) installed through request interception, so no database or backend process is needed. It mirrors the contracts in the [API reference](../../docs/reference/api.md), including account, holding, portfolio history and cash transaction endpoints; update it in the same change as any of those contracts.

Portfolio chart ranges and smoothing follow the [chart domain contract](../../docs/reference/api.md#portfolio-chart-domains). The daily axis retains the full session, the five-day axis compresses non-trading gaps, and monotone curves preserve trade transitions.
