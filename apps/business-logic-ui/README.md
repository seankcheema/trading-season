# Business UI

Angular login and registration screens using reactive forms, standalone components, and the shared UI package. Submission handlers are placeholders; API integration is unfinished.

From repository root:

```sh
npm ci
npm --workspace business-logic-ui start
npm --workspace business-logic-ui run build
npm --workspace business-logic-ui test -- --no-watch
```

Development runs on port 4200. See [routes](src/app/app.routes.ts), [shared components](../../packages/shared-ui-components/README.md), and [development prerequisites](../../docs/guides/development.md). Angular tests take --no-watch rather than Vitest's --run option.
