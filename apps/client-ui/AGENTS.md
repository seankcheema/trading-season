# Angular UI instructions

- Follow existing standalone components, reactive forms, OnPush change detection, and signal patterns.
- Import shared components through exported @shared/ui-components subpaths; avoid copying their implementations into this app.
- Preserve accessible labels, validation feedback, keyboard interactions, and responsive behavior.
- Check submission handlers before assuming API wiring exists. Integration changes must select the correct [authentication contract](../../docs/reference/api.md).
- Validate UI changes with the app build and relevant Angular tests. Use --no-watch; see [development](../../docs/guides/development.md#checks).
- Keep unit tests under src and end-to-end tests under e2e, which Playwright owns and the unit-test builder excludes. When an auth or registration contract changes, update the [e2e stand-in](e2e/fixtures/api-stub.ts) with it.
- Do not edit files under this application while a dev server is running; the watcher rebuilds on every change, and a Playwright run against that server fails on the restart.
- Keep `/dashboard/markets/:symbol` aligned with the dashboard's centered `max-w-[1600px]` shell. At desktop widths it is a `100dvh` no-document-scroll trading view; its Overview, Executions, and Recent Orders panels may scroll internally. Metrics, consensus, news, AI commentary, and recent orders on that page are explicitly demo data until corresponding APIs exist. Live symbol prices, OHLCV candles, range volume, and connection state must continue to come from the market APIs. Do not enable its Buy or Sell controls until authenticated UI trading integration is implemented.
