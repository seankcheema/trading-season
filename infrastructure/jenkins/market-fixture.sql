-- Only for the disposable Jenkins stack. A constant quote keeps execution checks
-- independent of wall-clock time, replay advancement, and external seed archives.
BEGIN;
INSERT INTO stocks (symbol, company_name, starting_price, sector, average_volume, base_volatility)
VALUES ('CIEQ', 'CI Equity', 100, 'Technology', 1000, 0);
INSERT INTO instruments (ticker, name, asset_class, market, currency, is_tradable, simulated_stock_symbol)
VALUES ('CIEQ', 'CI Equity', 'Equity', 'US', 'USD', true, 'CIEQ');
WITH session AS (
    INSERT INTO simulation_sessions (seed, drift, config, started_at, ended_at, status)
    VALUES (1, 0, '{"tick_storage":{"mode":"postgres"}}',
            '2026-01-05 14:30:00+00', '2026-01-05 14:31:00+00', 'COMPLETED')
    RETURNING id
), candle AS (
    INSERT INTO candles (session_id, symbol, "interval", "timestamp", open, high, low, close, volume, trade_count)
    SELECT id, 'CIEQ', '1m', '2026-01-05 14:30:00+00', 100, 100, 100, 100, 60, 60 FROM session
)
INSERT INTO market_ticks (session_id, symbol, "timestamp", price, bid, ask, bid_size, ask_size, trade_volume, sequence_number)
SELECT id, 'CIEQ', '2026-01-05 14:30:00+00'::timestamptz + n * interval '1 second',
       100, 99.99, 100.01, 100, 100, 1, n + 1
FROM session CROSS JOIN generate_series(0, 59) AS n;
COMMIT;
