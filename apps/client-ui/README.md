# Business UI

Angular login, registration, and dashboard screens using reactive forms, standalone components, signals, and the shared UI package. The dashboard market ticker reads the Java stock snapshot and live stream. The dashboard also creates and renames accounts, shows each account's holdings as its portfolio, and deposits and withdraws the cash all of a user's accounts share, through the planned account endpoints in the [API reference](../../docs/reference/api.md#ui-integration); the Java backend does not serve those yet. Net worth is that cash plus every account's portfolio. Trades and order submission remain mock-backed. Signed-in users are signed out after a configurable period of inactivity, 10 minutes by default; see the [API reference](../../docs/reference/api.md#ui-integration).

From repository root:

```sh
npm ci
npm --workspace business-logic-ui start
npm --workspace business-logic-ui run build
npm --workspace business-logic-ui test -- --no-watch
npm --workspace business-logic-ui run e2e
```

Development runs on port 4200 and proxies `/api` to the Java backend on port 8081. See [routes](src/app/app.routes.ts), [shared components](../../packages/shared-ui-components/README.md), and [development prerequisites](../../docs/guides/development.md). Angular tests take --no-watch rather than Vitest's --run option.

## Tests

Unit tests live beside the code they cover as `*.spec.ts` under `src`, and run on the Angular unit-test builder. The run fails below 60% coverage; the thresholds are in [angular.json](angular.json).

End-to-end tests live in [e2e](e2e) and run on Playwright, which owns that directory and is excluded from the unit-test builder. They cover the login, registration, inactivity timeout and account creation journeys against the running application, including where the password and SSN travel and how they are displayed, and that a user never sees another user's accounts. Install the browser once with `npx playwright install chromium`; the suite starts its own dev server, or reuses one already on port 4200.

The auth service and Java backend are replaced by [an in-memory stand-in](e2e/fixtures/api-stub.ts) installed through request interception, so no database or backend process is needed. It mirrors the contracts in the [API reference](../../docs/reference/api.md), including the planned account, holding and cash transaction endpoints; update it in the same change as any of those contracts.
