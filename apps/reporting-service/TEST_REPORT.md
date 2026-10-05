# Reporting Service Test Suite - Report

## Summary

241 tests, 98.63 percent statement coverage (2232/2263 statements, `--cov=.` from the service root, which also counts the test modules themselves). All 7 production modules are tested. Full canonical results, per-service comparison, and regeneration steps live in [docs/coverage/README.md](../../docs/coverage/README.md); this file is a quick local reference for this service only.

## Coverage by module

| Module | Coverage | Notes |
|--------|----------|-------|
| `config.py` | 100% | |
| `scheduled_tasks.py` | 100% | Disabled-scheduler, job-registration-failure, start-failure, and shutdown branches are reached by resetting the module-level `scheduler` singleton before calling it. |
| `routes.py` | 100% | Every endpoint is driven end to end with a mocked `verify_token` and real SQLite-backed fixtures, including a profitable and a losing SELL trade so win/loss/break-even branches execute. |
| `db_service.py` | 98% | 3 lines uncovered. |
| `models.py` | 98% | 3 `__repr__` lines uncovered. |
| `app.py` | 97% | Remaining misses: the PostgreSQL-only connection-pool branch (test DB is SQLite), the `version()` fallback for non-SQLite engines, and the `if __name__ == '__main__':` guard. |
| `wsgi.py` | 57% | Importing the module covers its body; the `if __name__ == '__main__':` block cannot run under pytest. |

## Test suite structure

```
tests/
├── conftest.py               - Database fixtures, Flask app, token generation
├── test_config.py            - Configuration, app initialization, endpoints
├── test_models.py            - SQLAlchemy ORM models, relationships
├── test_db_service.py        - Repository layer, queries, data access
├── test_auth.py              - JWT verification, decorators, auth flow
├── test_routes.py            - API endpoints, responses, error handling
├── test_routes_extended.py   - Helper functions, edge cases
├── test_scheduled_tasks.py   - Background jobs, scheduler lifecycle
└── test_full_coverage.py     - Full request/response endpoint coverage, JWKS/verify_token
                                 branches, error-handler and init_app paths, scheduler
                                 branch coverage
```

## Running tests

```bash
# Run all tests with coverage (matches pytest.ini addopts)
python -m pytest

# Run a specific test file
python -m pytest tests/test_full_coverage.py -v

# Open the HTML coverage report
start htmlcov/index.html
```

## Known limitations

- `PyJWT` is listed in `requirements.txt` without the `cryptography` extra, so `jwt.algorithms.RSAAlgorithm` is not importable in this environment. Tests that exercise `verify_token`'s success/expired/invalid branches patch `jwt.algorithms.RSAAlgorithm` and `jwt.decode` directly rather than performing a real RS256 round trip. This also means RS256 verification would fail at runtime wherever `cryptography` is absent - worth confirming the deployed environment actually has it (it is not pinned in `requirements.txt`).
- `pytest.ini` does not enforce a minimum coverage threshold (no `--cov-fail-under`), so this report can drift from the repository state; regenerate with `pytest` before trusting it.
