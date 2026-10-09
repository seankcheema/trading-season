# Reporting service instructions

- Keep the reporting service contract in sync across [app.py](app.py), [routes.py](routes.py), [openapi.yaml](openapi.yaml), and [README.md](README.md). The checked-in OpenAPI file is the canonical Swagger source for this service.
- Preserve the public docs endpoints `GET /docs` and `GET /openapi.yaml`. If paths change, update the Swagger table in the root [README.md](../../README.md) in the same change.
- Route changes require matching updates to the OpenAPI spec and tests under [tests](tests). Document only implemented behavior.
- Keep JWT verification aligned with the auth service JWKS contract. Do not add fallback signing keys or disable issuer checks. The profile endpoint serves the bearer token's `sub` only. Every endpoint that covers other accounts, the runs and the console, must sit behind `require_role` for `ANALYST`.
- The report runs take trade data from the `trade-events` files only; do not make them read orders from the database. The analyst console in [console.py](console.py) is the part that reads the database, and it only reads: no endpoint of this service writes to it.
- Never return password hashes, SSNs, addresses or dates of birth. Keep the password hash column unmapped in [models.py](models.py).
- Console queries must run on the tests' SQLite as well as PostgreSQL: filter in SQL, aggregate in Python, and compare timestamps as UTC.
- For SonarQube or static-analysis fixes, preserve the current HTTP contract and auth boundaries first. Prefer small, behavior-preserving refactors with matching test updates over suppressing findings.
- Treat dependency pins as runtime compatibility constraints. If Python-version support changes, update [requirements.txt](requirements.txt), Docker build assumptions, and tests together.
- Use `python -m pytest` from this directory for local validation. When adjusting quality tooling, keep coverage artifacts and report paths consistent with the Reporting Service stage in the [Jenkinsfile](../../infrastructure/jenkins/Jenkinsfile).