# Reporting

Status: the reporting pipeline is implemented end to end on the backend; the Reporting App that presents it is still a placeholder page. Source: [apps/reporting-service](../../apps/reporting-service).

## What runs today

Reporting never reads trade data from the trading tables. It receives it from the `trade-events` Kafka topic and keeps its own copy as files, which matches the reference architecture's file-based reporting store and keeps analysis off the live trading path (BR-16).

1. Order and Sell publishes one message per committed order status change, `ACCEPTED`, `FILLED` or `REJECTED`, after that transaction commits, keyed by account id.
2. The reporting consumer, a separate container running [consumer.py](../../apps/reporting-service/consumer.py) in consumer group `reporting-ingester`, appends each message as one JSON line to `events/trade-events-p<partition>.jsonl` on the `reporting_files` volume, then commits the offset. A redelivered offset is skipped, so a crash between the write and the commit never duplicates a line. See [event_store.py](../../apps/reporting-service/event_store.py).
3. Every `SCHEDULER_INTERVAL_MINUTES` (default 15) the same process runs [report_run.py](../../apps/reporting-service/report_run.py): it reads every event file, joins account and user names from PostgreSQL, and writes a run directory `runs/<UTC timestamp>/` holding `report.json` and three PNG charts. `runs/latest` points at the new run and older runs are deleted, so the store always holds the current report. This is the only point where reporting touches PostgreSQL, and only the `users` and `accounts` tables, read only.
4. The Flask web service, running gunicorn with the scheduler disabled, exposes the runs. See the [API reference](api.md#reporting-service-python-flask-port-8083).

### Insights in a run (BR-17)

`report.json` carries `statusCounts` (filled versus rejected), `volumeBySymbol` (fills, shares and notional per symbol, filled orders only), `tradesPerAccount` (total, filled and rejected per account with the account and trader names), and `dailyCounts` per UTC day. `ACCEPTED` events are kept in the files as part of each order's lifecycle but are not counted as trades; only final statuses are. The charts are `volume_by_symbol.png`, `daily_trades.png` and `trades_per_account.png`.

### Boundaries

- The reporting service owns no table and writes nothing to `trading_season`. Its store is the `reporting_files` volume.
- The store is derived data. To rebuild it: stop `reporting-consumer`, delete the volume's contents, reset the `reporting-ingester` group's offset to earliest with `kafka-consumer-groups.sh`, and start the consumer again. Events older than the broker's retention are gone from Kafka, so the files are the long-term record for reporting.
- Exactly one consumer instance runs. Two would split partitions and append to the same files.
- The consumer group id must stay `reporting-ingester`; its committed offsets live in the broker and carry across restarts. The Java placeholder that used this group id before was removed in the same change, so no old container should be sharing the group.

## Not yet built

- The Reporting App screens from the reference architecture (report list, viewer, parameters, customer resolution). `apps/reporting-ui` is a static placeholder. Separate UI story.
- Portfolio performance measures such as returns, drawdown or Sharpe ratio. Their formulas and inputs still need agreeing; the run is the place to add them once they are.
- Per-request analytical queries. The design is run-based on purpose; a request reads the latest run.

## Acceptance for future work

Reconcile computed results against deterministic fixtures, as [test_report_run.py](../../apps/reporting-service/tests/test_report_run.py) does for the current insights. Keep the consumer idempotent across redelivery. Document data freshness, which is the run interval, wherever a report is shown.
