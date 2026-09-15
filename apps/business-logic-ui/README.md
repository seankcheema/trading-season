# Business UI

Angular login, registration, and dashboard screens using reactive forms, standalone components, signals, and the shared UI package. The dashboard market ticker reads the Java stock snapshot and live stream; authentication, portfolio, and order submission remain placeholders or mock-backed.

From repository root:

```sh
npm ci
npm --workspace business-logic-ui start
npm --workspace business-logic-ui run build
npm --workspace business-logic-ui test -- --no-watch
```

Development runs on port 4200 and proxies `/api` to the Java backend on port 8081. See [routes](src/app/app.routes.ts), [shared components](../../packages/shared-ui-components/README.md), and [development prerequisites](../../docs/guides/development.md). Angular tests take --no-watch rather than Vitest's --run option.
