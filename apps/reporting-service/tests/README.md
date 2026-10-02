# Reporting Service Test Suite

## Overview

This test suite covers the Trading Season Reporting Service: unit tests, integration tests against a SQLite-backed Flask test client, and direct unit tests of helper functions.

## Current coverage

Run `pytest` from `apps/reporting-service` to regenerate. See [docs/coverage/README.md](../../../docs/coverage/README.md) for the canonical, cross-service numbers; the table below is a quick reference for this directory.

| Module | Coverage |
|-----------|----------|
| config.py | 100% |
| routes.py | 100% |
| scheduled_tasks.py | 100% |
| db_service.py | 98% |
| models.py | 98% |
| app.py | 97% |
| wsgi.py | 57% (only its `if __name__ == '__main__':` guard is unreachable under pytest) |

## Test organization

### Directory structure
```
tests/
├── conftest.py              # Pytest fixtures and test configuration
├── __init__.py              # Package initialization
├── test_config.py           # Configuration and app initialization tests
├── test_models.py           # SQLAlchemy model tests
├── test_db_service.py       # Database repository layer tests
├── test_routes.py           # API endpoint tests
├── test_routes_extended.py  # Helper function and edge-case tests
├── test_auth.py             # Authentication and JWT tests
├── test_scheduled_tasks.py  # Background scheduler tests
└── test_full_coverage.py    # End-to-end endpoint tests (real DB fixtures + mocked
                              # verify_token), JWKS/verify_token branches, error
                              # handlers, init_app, and scheduler branch coverage
```

## Running tests

### Run all tests with coverage
```bash
python -m pytest
```
(`pytest.ini` already sets `--cov=. --cov-report=term-missing --cov-report=html --cov-report=xml`.)

### Run a specific test file
```bash
python -m pytest tests/test_models.py -v
```

### Run a specific test class or test
```bash
python -m pytest tests/test_config.py::TestConfig -v
python -m pytest tests/test_models.py::TestUserModel::test_user_creation -v
```

### View the HTML coverage report
```bash
python -m pytest
start htmlcov/index.html
```

## Test fixtures

All tests use centralized fixtures defined in `conftest.py`, plus a few additional ones in `test_full_coverage.py` for multi-trade and second-user scenarios:

### Database fixtures (`conftest.py`)
- `app` - Flask application instance with a SQLite test database
- `client` - Flask test client for making HTTP requests
- `db_session` - Clean database session per test (tables dropped/recreated)
- `runner` - Flask CLI test runner

### Model fixtures (`conftest.py`)
- `test_user` - Sample User with a unique email per test
- `test_account` - Sample Account linked to `test_user`
- `test_instrument` - Sample Instrument (AAPL)
- `test_order` / `test_fill` - A BUY order and its fill (break-even trade)
- `test_holding` - Sample Holding in `test_account`
- `test_cash_transaction` - Sample deposit transaction
- `valid_token` / `mock_jwks` - JWT and JWKS test doubles

### Additional fixtures (`test_full_coverage.py`)
- `other_user` - A second user with no accounts, for empty-state branches
- `sell_order_profit` / `sell_order_loss` - A profitable and a losing SELL trade, so
  win/loss/break-even branches in the statistics helpers all execute

### Key features
- Automatic isolation: each test gets fresh database tables
- Unique values: fixtures generate unique IDs/emails to avoid constraint violations
- Rollback safety: database changes are torn down after each test

## Test categories

### Configuration (`test_config.py`)
Flask app initialization, configuration loading, environment handling, health/root
endpoints, and the 404/401/403/500 error handlers.

### Models (`test_models.py`)
SQLAlchemy ORM models and their relationships, timestamps, constraints, and `__repr__`.

### Database service (`test_db_service.py`)
Repository pattern for the data access layer: `UserRepository`, `AccountRepository`,
`HoldingRepository`, `OrderRepository`, `TradeRepository`, `CashTransactionRepository`,
`AuditRepository`, `MetadataRepository`.

### Authentication (`test_auth.py`, plus `test_full_coverage.py::TestVerifyTokenBranches`
and `TestJWKSCacheSuccess`)
JWKS caching and TTL, `@require_auth`, JWT claims, Bearer token extraction, and
`verify_token`'s success, expired, invalid, and key-not-found branches (the RSA
verification itself is mocked - see "Known limitations" below).

### Routes/API (`test_routes.py`, `test_routes_extended.py`, `test_full_coverage.py`)
Every endpoint - portfolio, trade history/detail/statistics/drill-down, performance
metrics, user profile, scheduler status - driven through the Flask test client with a
mocked `verify_token` and real fixtures, covering success, 400/404/500 error paths,
pagination, and filtering. Helper functions tested directly:
- `_calculate_trade_statistics()` - win rate, profit factor, P&L metrics
- `_analyze_by_symbol()` / `_analyze_by_order_type()` - grouped trade breakdowns
- `_get_best_worst_trades()` - top/bottom performers
- `_calculate_performance_metrics()` - Sharpe ratio, max drawdown, volatility
- `_calculate_daily_returns()` - daily P&L aggregation, including malformed/missing
  `executed_at` values
- `_calculate_volatility()` / `_calculate_downside_deviation()` - Sortino inputs
- `_calculate_max_drawdown()` / `_calculate_current_drawdown()`

### Scheduled tasks (`test_scheduled_tasks.py`, `test_full_coverage.py`)
Scheduler initialization, the `SCHEDULER_ENABLED`/interval config, job-registration and
start failures, shutdown (including when the scheduler was never started),
`refresh_reporting_data()` and its nested error handling, and `get_refresh_status()`.

## Key test patterns

### Fixture usage
```python
def test_example(test_user, test_account, db_session):
    accounts = db_session.query(Account).filter_by(user_id=test_user.user_id).all()
    assert len(accounts) >= 1
```

### Mock patching
```python
def test_with_mock(mocker):
    mock_get = mocker.patch('routes.AccountRepository.get_user_accounts')
    mock_get.return_value = []
```

### Authenticated endpoint calls
```python
def test_authenticated_endpoint(client, test_user, mocker):
    mocker.patch('app.verify_token', return_value={'sub': str(test_user.user_id)})
    response = client.get('/api/reporting/profile', headers={'Authorization': 'Bearer t'})
    assert response.status_code == 200
```

## Database configuration for tests

Tests use a SQLite in-memory database (`sqlite:///:memory:`) so the suite needs no
PostgreSQL installation, runs in a few seconds, and gets a fresh schema per test.
Set automatically in `conftest.py`:
```python
os.environ['FLASK_ENV'] = 'testing'
os.environ['TEST_DATABASE_URL'] = 'sqlite:///:memory:'
```

## Debugging tests

```bash
pytest -vv --tb=long      # verbose output with full tracebacks
pytest -v -s              # show print statements
pytest --pdb              # drop into debugger on failure
pytest --lf               # run only last-failed tests
pytest -x                 # stop after first failure
pytest --durations=10     # profile slowest tests
```

## Known limitations

- `requirements.txt` pins `PyJWT` without the `cryptography` extra, so
  `jwt.algorithms.RSAAlgorithm` is not importable in this environment and RS256
  verification cannot be exercised end to end. `test_full_coverage.py` patches
  `jwt.algorithms.RSAAlgorithm` and `jwt.decode` directly to cover `verify_token`'s
  branches instead of performing a real RS256 round trip.
- `pytest.ini` does not set `--cov-fail-under`, so coverage is reported but not
  enforced as a CI gate for this service (unlike the other four services - see
  [coverage floors](../../../docs/guides/development.md#coverage-floors)).

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Flask Testing](https://flask.palletsprojects.com/testing/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/orm/session_basics.html#testing-orm-mapped-classes)
- [Coverage.py](https://coverage.readthedocs.io/)
