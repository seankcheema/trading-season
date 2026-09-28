# Reporting service

Status: runnable container placeholder; no reporting service is implemented.

Local Compose exposes an Nginx placeholder on host port 8083. `GET /health` returns HTTP 200 JSON so Jenkins can verify the planned service boundary is running. The root response also identifies the service as a placeholder. There are no reporting endpoints, calculations, scheduled jobs, persistence, authorization, or business-data access.

Read the [reporting proposal](../../docs/reference/reporting.md) before selecting a runtime or implementing the first functional slice. The placeholder does not establish the future service framework or API design.
