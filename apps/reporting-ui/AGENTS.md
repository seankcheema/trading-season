# Reporting UI instructions

- Follow the existing standalone components, OnPush change detection, and signal patterns. The auth code under `src/app/core/auth` mirrors the Client UI's token handling; keep the two behaving the same when either changes. The analyst checks are this app's own.
- Only analysts use this app. The role name and the no-access message live in [reporting-access.ts](src/app/core/auth/reporting-access.ts); the Reporting Service enforces the rule, and the UI checks only decide what to show. Do not treat a UI check as the access control.
- Show only what the [Reporting Service](../reporting-service/README.md) serves. Do not add demo or mock data to a screen. A screen that needs data the service does not expose needs the endpoint first.
- [openapi.yaml](../reporting-service/openapi.yaml) is the contract. Keep [report.models.ts](src/app/reporting/report.models.ts) and [ReportingApiService](src/app/reporting/reporting-api.service.ts) in step with it.
- Both backends are reached on the UI's own origin. A new backend path needs the same entry in both [proxy.conf.json](proxy.conf.json) and [nginx.conf](nginx.conf).
- Style from the design tokens in [src/styles.css](src/styles.css). Keep their values identical to the dark theme in the Client UI's `src/styles.css`. Filled orders use the gain color and rejected orders the loss color.
- This app does not import the Client UI's shared-ui-components. Using one here makes it a second consumer, which the root [AGENTS.md](../../AGENTS.md) says is the point to extract it into a top-level package first.
- Preserve accessible labels, validation feedback, keyboard interactions, and the narrow-viewport layout.
- Validate changes with the app build and the Angular tests. Use --no-watch; see the [README](README.md#commands). Keep test data in `src/testing`, which the application build excludes.
- Do not edit files under this application while a dev server is running; the watcher rebuilds on every change.
