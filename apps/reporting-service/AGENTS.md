# Reporting service instructions

- Keep the reporting service contract in sync across [app.py](app.py), [routes.py](routes.py), [openapi.yaml](openapi.yaml), and [README.md](README.md). The checked-in OpenAPI file is the canonical Swagger source for this service.
- Preserve the public docs endpoints `GET /docs` and `GET /openapi.yaml`. If paths change, update the Swagger table in the root [README.md](../../README.md) in the same change.
- Route changes require matching updates to the OpenAPI spec and tests under [tests](tests). Document only implemented behavior.
- Keep JWT verification aligned with the auth service JWKS contract. Do not add fallback signing keys or disable issuer checks. The profile endpoint serves the bearer token's `sub` only. Every endpoint that covers other accounts must sit behind `require_role`: the runs for `ANALYST` or `ADMIN`, the console for `ADMIN` only.
- This service reads Kafka and nothing else. Never give it a connection to the trading database: no driver in [requirements.txt](requirements.txt), no database URL in [config.py](config.py), no `db` dependency in Compose. If the console needs something that is not published, publish it from the service that owns the row; do not read it here.
- The report runs take trade data from the `trade-events` files only. The console in [console.py](console.py) queries the read model in [models.py](models.py), which [read_model.py](read_model.py) builds from the event files and nothing else.
- Everything in [projection.py](projection.py) must be an upsert keyed by the row's own id, safe to apply twice and safe to apply after a newer message: a replay of the whole history has to leave the same rows. Validate a message completely before the first statement runs.
- Use the tables only while holding `read_model.lock`. Every thread of a process shares one connection.
- Analysts and admins are staff, not customers: keep them out of the customer list and out of the single-customer endpoint.
- Never return password hashes, SSNs, addresses or dates of birth, and never add a read model column that could hold one.
- Filter in SQL, aggregate in Python, and compare timestamps as UTC: SQLite hands them back naive.
- The pipeline greps this service's log for `Stored trade event orderId=` and `Stored platform record type=`; keep those lines when changing [consumer.py](consumer.py).
- For SonarQube or static-analysis fixes, preserve the current HTTP contract and auth boundaries first. Prefer small, behavior-preserving refactors with matching test updates over suppressing findings.
- Treat dependency pins as runtime compatibility constraints. If Python-version support changes, update [requirements.txt](requirements.txt), Docker build assumptions, and tests together.
- Use `python -m pytest` from this directory for local validation. When adjusting quality tooling, keep coverage artifacts and report paths consistent with the Reporting Service stage in the [Jenkinsfile](../../infrastructure/jenkins/Jenkinsfile).
