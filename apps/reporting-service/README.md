# Reporting Service

Python Flask service that turns the `trade-events` Kafka topic into reports. It never reads trade data from the trading database.

## How it works

1. Order and Sell publishes one message per committed order status change (`ACCEPTED`, `FILLED`, `REJECTED`), keyed by account id. The run counts only final statuses as trades.
2. `consumer.py`, consumer group `reporting-ingester`, appends each message as one JSON line to `events/trade-events-p<partition>.jsonl` under `REPORTING_FILES_DIR`, then commits the offset. Offsets already on disk are skipped, so redelivery never duplicates a line.
3. Every `SCHEDULER_INTERVAL_MINUTES` the same process runs `report_run.py`: reads the event files, joins account and trader names from PostgreSQL (`users` and `accounts`, read only), and writes `runs/<UTC timestamp>/report.json` plus three PNG charts. `runs/latest` points at the new run; older runs are deleted.
4. The web service (`wsgi.py` under gunicorn) serves the runs behind the same RS256 tokens the Java services accept.

See [Reporting](../../docs/reference/reporting.md) for the design and [API reference](../../docs/reference/api.md#reporting-service-python-flask-port-8083) for the endpoints.

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

## Endpoints

Public: `GET /health`, `GET /`, `GET /api/reporting/scheduler/status`.

Bearer token required: `GET /api/reporting/profile`, `GET /api/reporting/runs`, `GET /api/reporting/runs/latest`, `GET /api/reporting/runs/{runId}/files/{name}`.

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
| `SCHEDULER_INTERVAL_MINUTES` | `15` | Report run interval |

## Files on the volume

```
<REPORTING_FILES_DIR>/
  events/trade-events-p0.jsonl   # one line per message: partition, offset, accountId, orderId, status,
  events/trade-events-p1.jsonl   #   symbol, side, quantity, price, rejectionReason, occurredAt
  events/trade-events-p2.jsonl
  runs/<YYYYMMDDTHHMMSSZ>/report.json, volume_by_symbol.png, daily_trades.png, trades_per_account.png
  runs/latest                    # the current run id
```

Everything here is derived. To rebuild: stop the consumer, delete the directory contents, reset the group's offset to earliest (`kafka-consumer-groups.sh --group reporting-ingester --topic trade-events --reset-offsets --to-earliest --execute`), start the consumer.

## Tests

```sh
pytest
```

Tests use in-memory SQLite, a temporary files directory and a fake Kafka source. No broker, database or Docker is needed. Coverage is reported through `pytest-cov` (see `pytest.ini`).

## Docker

The image runs gunicorn by default; Compose starts a second container from the same image with `command: ["python", "consumer.py"]`. Both mount the `reporting_files` volume at `/data/reporting`, the web service read-only. See [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml).

## Known limitations

- Portfolio performance measures (returns, drawdown, Sharpe) are not computed yet; the run produces volume, activity and fill/rejection insights.
- Admin role authorization is not enforced; any valid token can read the runs.
- The Reporting UI that presents the runs is a placeholder, tracked separately.
