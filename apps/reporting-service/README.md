# Reporting Service

Python Flask service with two jobs. It turns the `trade-events` Kafka topic into scheduled reports, for analysts and admins, and it serves read-only views of platform activity, orders and customers for the [Reporting UI](../reporting-ui/README.md)'s console, for admins only.

- Port 8083, Swagger UI at http://localhost:8083/docs, OpenAPI at `/openapi.yaml`
- Served by Gunicorn in Docker. The [Reporting UI](../reporting-ui/README.md) presents the runs; it calls this service through its own origin, so it needs no entry in `CORS_ORIGINS`.

## How it works

1. Order and Sell publishes one message per committed order status change (`ACCEPTED`, `FILLED`, `REJECTED`), keyed by account id. The run counts only final statuses as trades.
2. `consumer.py`, consumer group `reporting-ingester`, appends each message as one JSON line to `events/trade-events-p<partition>.jsonl` under `REPORTING_FILES_DIR`, then commits the offset. Offsets already on disk are skipped, so redelivery never duplicates a line.
3. When it starts, and then every `SCHEDULER_INTERVAL_MINUTES`, the same process runs `report_run.py`: reads the event files, joins account and trader names and each trader's level from PostgreSQL (`users` and `accounts`, read only), and writes `runs/<UTC timestamp>/report.json` plus four PNG charts. `runs/latest` points at the new run; older runs are deleted. The first run reports the events already on disk, so a restart serves a report at once; a run that comes due while the process is busy runs late instead of being skipped. The charts use the Reporting UI's dark surface and colors, filled orders in the gain color and rejected orders in the loss color.
4. The web service (`wsgi.py` under gunicorn) serves the runs behind the same RS256 tokens the Java services accept, to accounts with the `ANALYST` or `ADMIN` role only.

The report runs never read trade data from the database: the topic is their only source, and PostgreSQL gives them names and trader levels.

A run holds the three views the business asked to analyse trading by (BR-16: instrument, period and client segment) and a count per account, none of which touches the live trading path:

| View | In `report.json` | Chart |
| --- | --- | --- |
| By instrument | `volumeBySymbol`: fills, shares and notional per symbol | `volume_by_symbol.png` |
| By period | `dailyCounts`: filled and rejected orders per UTC day | `daily_trades.png` |
| By client segment | `activityBySegment`: active accounts, fills, rejections and notional per trader level | `volume_by_segment.png` |
| By account | `tradesPerAccount`: resolved orders per account | `trades_per_account.png` |

A client segment is a trader's level: `BEGINNER`, `INTERMEDIATE` or `ADVANCED`, the only classification of clients the product keeps. A trader counts under the level they hold when the run is made, whatever it was when they traded. Orders of an account the database does not know are counted under `UNKNOWN`.

### Console

The console endpoints are the other half, served to admins only because they show individual customers and their orders. They do read the database, because they show what the topic does not carry: cash movements, sign-in locks, ledger postings and the audit trail. [console.py](console.py) only reads, and aggregates in Python over plainly filtered rows, so the same code runs on PostgreSQL and on the SQLite database the tests use.

| View | Tables read |
| --- | --- |
| Activity: figures against the prior period, notional over time, status split, split by client segment, newest events, most traded symbols | `orders`, `fills`, `cash_transactions`, `user_accounts`, `users`, `accounts`, `instruments`, `simulation_sessions` |
| Orders with the deposits and withdrawals beside them, and one order with its ledger impact and audit trail | the above, plus `holdings`, `holding_movements`, `audit_trail` |
| Customers, and one customer with balances, orders and transfers | `user_accounts`, `users`, `accounts`, `portfolio_valuations`, and the order tables |

- A range is the viewer's own days: the UI sends its offset from UTC, and "today" starts at the viewer's midnight. Each figure is compared with the period of equal length just before the range.
- Activity is split by client segment the same way a run is: by trader level, as each trader holds it now. It counts the traders of a level who placed an order in the range, their orders and the notional filled.
- Cash and holdings before and after an order are not stored per order. They are worked back from today's balance by removing every posting made after the order's own.
- A customer is a sign-in with the `TRADER` role. Analysts and admins are staff: they are left out of the customer list and answered 404 as a customer.
- A transfer is a `cash_transactions` row whose reason is `DEPOSIT` or `WITHDRAWAL`. What an order's fill posted to cash is part of that order, not a transfer.
- A customer is `LOCKED` while `user_accounts.locked_until` is in the future. The password hash column is not mapped in [models.py](models.py), so it cannot be selected; SSNs, addresses and dates of birth are never returned.
- Nothing here writes. An admin cannot unlock an account from reporting.

## Technology

- Python 3.14, Flask 3, Flask-SQLAlchemy over psycopg 3
- confluent-kafka for the consumer, APScheduler for the report job, matplotlib (Agg) for charts
- gunicorn for the web service; one image, two processes

## Local development

Prerequisites: Python 3.14, the Compose stack's database and Kafka (`docker compose ... up -d db-init kafka-init`), and the auth service for tokens.

```sh
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # adjust DATABASE_URL and KAFKA_BOOTSTRAP_SERVERS if needed
python consumer.py                # terminal 1: consumer plus report scheduler
FLASK_ENV=development python app.py   # terminal 2: web service on 8083
```

On the host the broker is `localhost:29092` and the files land in `./data/reporting` (ignored by git). Run exactly one consumer at a time.

On Windows, [scripts/start-local.ps1](../../scripts/start-local.ps1) starts both processes from this `venv` with the rest of the stack, and can start a broker without Docker; see [Local processes](../../README.md#local-processes-windows).

## Endpoints

Authenticated endpoints need an RS256 bearer token from the [Auth Service](../auth-service/README.md). The run and console endpoints cover every account on the platform, so they also need a role in the token's `roles` claim, and a valid token without it is answered 403. The run endpoints accept `ANALYST` or `ADMIN`. The console endpoints accept `ADMIN` only, because they show individual customers and their orders. The profile is the caller's own and needs only a valid token.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/` | public | Service information and entry points |
| GET | `/health` | public | Liveness and database check |
| GET | `/docs`, `/openapi.yaml` | public | Swagger UI and the OpenAPI contract |
| GET | `/api/reporting/profile` | any token | The caller's trader profile |
| GET | `/api/reporting/runs` | `ANALYST`, `ADMIN` | Every complete report run, newest first, with the latest run id |
| GET | `/api/reporting/runs/latest` | `ANALYST`, `ADMIN` | The latest run's `report.json`; 404 until the first run |
| GET | `/api/reporting/runs/{runId}/files/{name}` | `ANALYST`, `ADMIN` | One PNG chart of a run |
| GET | `/api/reporting/scheduler/status` | public | Latest run id, when it was generated, and the interval |
| GET | `/api/reporting/activity?range=&tzOffset=` | `ADMIN` | Platform activity over `today`, `7d`, `30d` or `90d`, in the viewer's days |
| GET | `/api/reporting/orders?limit=` | `ADMIN` | The newest orders across every account, 500 unless `limit` says otherwise (1 to 1000), and the newest deposits and withdrawals under the same limit |
| GET | `/api/reporting/orders/{orderId}` | `ADMIN` | One order with its execution, ledger impact and audit trail |
| GET | `/api/reporting/customers` | `ADMIN` | Every trader with their balances and lock status; analysts and admins are left out |
| GET | `/api/reporting/customers/{userId}` | `ADMIN` | One customer with their accounts, orders and transfers; 404 for an analyst or admin |

[openapi.yaml](openapi.yaml) is the canonical contract. Keep it, [routes.py](routes.py), [app.py](app.py), and the tests in step.

## Design

```mermaid
flowchart LR
    K[["Kafka trade-events"]] -- "group reporting-ingester" --> C["consumer.py<br/>append events, run the report job"]
    C --> E["events/*.jsonl"]
    C --> R["runs/<id>/report.json + PNG"]
    C -. "account and trader names" .-> DB[("trading_season<br/>users, accounts")]
    Client --> App["app.py<br/>Flask, /health, /docs, require_auth, require_role"]
    App --> Routes["routes.py<br/>/api/reporting blueprint"]
    Routes --> R
    Routes -. "profile" .-> DB
    Routes --> Console["console.py<br/>activity, orders, customers"]
    Console -. "read only" .-> Ledger[("trading_season<br/>orders, fills, cash, locks, audit trail")]
    App -. "JWKS, cached 1 h" .-> Auth["Auth Service"]
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://trading_season:password@localhost:5432/trading_season` | Read-only lookups of `users` and `accounts`; plain `postgresql://` is normalised |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | JWKS source for token verification |
| `AUTH_JWT_ISSUER` | `http://localhost:3001` | Expected `iss` claim; must equal the auth service's issuer |
| `CORS_ORIGINS` | `http://localhost:4200` | Allowed browser origins, comma-separated |
| `REPORTING_FILES_DIR` | `./data/reporting` (host), `/data/reporting` (image) | Event files and report runs |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:29092` | Broker; Compose sets `kafka:9092` |
| `KAFKA_TRADE_EVENTS_TOPIC` | `trade-events` | Topic to consume |
| `REPORTING_CONSUMER_GROUP` | `reporting-ingester` | Consumer group; keep it stable so offsets carry across restarts |
| `SCHEDULER_ENABLED` | `True` | Run the report job; the web service is started with `false` |
| `SCHEDULER_INTERVAL_MINUTES` | `15` | Report run interval, after the run the consumer makes when it starts |

## Files on the volume

```
<REPORTING_FILES_DIR>/
  events/trade-events-p0.jsonl   # one line per message: partition, offset, accountId, orderId, status,
  events/trade-events-p1.jsonl   #   symbol, side, quantity, price, rejectionReason, occurredAt
  events/trade-events-p2.jsonl
  runs/<YYYYMMDDTHHMMSSZ>/report.json, volume_by_symbol.png, daily_trades.png, volume_by_segment.png,
                           trades_per_account.png
  runs/latest                    # the current run id
```

Everything here is derived. To rebuild: stop the consumer, delete the directory contents, reset the group's offset to earliest (`kafka-consumer-groups.sh --group reporting-ingester --topic trade-events --reset-offsets --to-earliest --execute`), start the consumer.

## Tests

```sh
pytest
```

Tests use in-memory SQLite, a temporary files directory and a fake Kafka source. No broker, database or Docker is needed. Coverage is reported through `pytest-cov` (see `pytest.ini`).

## Docker

The image runs gunicorn by default; Compose starts a second container from the same image with `command: ["python", "consumer.py"]`. Both mount the `reporting_files` volume at `/data/reporting`, the web service read-only. The consumer is a separate container rather than a thread in the web app because gunicorn runs several worker processes, and the consumer must run exactly once: one writer per partition file and one scheduler. Same code, same image, a different command; nothing is duplicated. See [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml).

## Known limitations

- Portfolio performance measures (returns, drawdown, Sharpe) are not computed yet; the run produces volume, activity and fill/rejection insights.
- A trader's level is not kept over time, so a segment is always today's level: a trader who was promoted takes their earlier orders with them into the new segment.
- The console reads the live trading database, so it is the report runs, built from the topic, that are independent of live trading. The console only reads, and is asked every 15 to 30 seconds per open screen.
- The console aggregates in Python, which suits a simulation's order volume. It loads the orders of twice the chosen range per request and would need SQL aggregation for a large one.
- The quote an order executed against is not in the database, so an order shows its indicative price, price buffer and slippage in place of bid, ask and spread.
