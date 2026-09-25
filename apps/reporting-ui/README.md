# Reporting UI

Status: runnable container placeholder; no reporting UI is implemented.

Local Compose serves a static placeholder page at `http://localhost:4300`. Its Nginx container exists only to make the future service boundary visible in local and Jenkins container inspection. It has no framework, authentication, data access, charts, or reporting behavior.

Read the [reporting proposal](../../docs/reference/reporting.md) before implementing the first functional slice. Replace the placeholder deliberately rather than treating it as an established application architecture.
