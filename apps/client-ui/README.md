# Business UI

Angular login, registration, and dashboard screens using reactive forms, standalone components, signals, and the shared UI package. The dashboard market ticker and instrument charts read the Java stock snapshot, OHLCV candle API, and live stream. Selecting a ticker, search result, or holding opens the existing instrument popup; its full-screen action navigates to the protected `/dashboard/markets/:symbol` route. That route uses the dashboard's centered wrapper and a one-viewport desktop trading layout; tablet and mobile layouts stack and scroll. Symbol prices, candles, range volume, and connection state are live. Metrics, consensus, news, AI commentary, and recent orders are labeled demo data until APIs exist, and execution controls remain disabled. Supported chart ranges are `1D`, `5D`, `1M`, and `1Y`.

The dashboard also creates and renames accounts, shows each account's holdings as its portfolio, and deposits and withdraws the cash all of a user's accounts share, through the planned account endpoints in the [API reference](../../docs/reference/api.md#ui-integration); the Java backend does not serve those yet. Net worth is that cash plus every account's portfolio. On the full-screen market page, Buy and Sell controls are deliberately disabled and labeled as coming soon; that page does not submit or simulate orders. Signed-in users are signed out after a configurable period of inactivity, 10 minutes by default; see the [API reference](../../docs/reference/api.md#ui-integration).

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

Unit tests live beside the code they cover as `*.spec.ts` under `src`, and run on the Angular unit-test builder. The run fails below 60% coverage; the thresholds are in [angular.json](angular.json).

End-to-end tests live in [e2e](e2e) and run on Playwright, which owns that directory and is excluded from the unit-test builder. They cover the login, registration, inactivity timeout and account creation journeys against the running application, including where the password and SSN travel and how they are displayed, and that a user never sees another user's accounts. Install the browser once with `npx playwright install chromium`; the suite starts its own dev server, or reuses one already on port 4200.

The auth service and Java backend are replaced by [an in-memory stand-in](e2e/fixtures/api-stub.ts) installed through request interception, so no database or backend process is needed. It mirrors the contracts in the [API reference](../../docs/reference/api.md), including the planned account, holding and cash transaction endpoints; update it in the same change as any of those contracts.
