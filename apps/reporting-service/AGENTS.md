# Reporting service instructions

- Keep the reporting service contract in sync across [app.py](app.py), [routes.py](routes.py), [openapi.yaml](openapi.yaml), and [README.md](README.md). The checked-in OpenAPI file is the canonical Swagger source for this service.
- Preserve the public docs endpoints `GET /docs` and `GET /openapi.yaml`. If paths change, update [docs/SWAGGER_DOCS.md](../../docs/SWAGGER_DOCS.md), [docs/reference/api.md](../../docs/reference/api.md), and [README.md](../../README.md) in the same change.
- Route changes require matching updates to the OpenAPI spec and tests under [tests](tests). Document only implemented behavior; keep planned work in [docs/reference/reporting.md](../../docs/reference/reporting.md).
- Keep JWT verification aligned with the auth service JWKS contract. Do not add fallback signing keys, disable issuer checks, or widen data scope beyond the bearer token's `sub`.
- For SonarQube or static-analysis fixes, preserve the current HTTP contract and auth boundaries first. Prefer small, behavior-preserving refactors with matching test updates over suppressing findings.
- Treat dependency pins as runtime compatibility constraints. If Python-version support changes, update [requirements.txt](requirements.txt), Docker build assumptions, and tests together.
- Use `python -m pytest` from this directory for local validation. When adjusting quality tooling, keep coverage artifacts and report paths consistent with Jenkins expectations in [docs/guides/operations.md](../../docs/guides/operations.md).