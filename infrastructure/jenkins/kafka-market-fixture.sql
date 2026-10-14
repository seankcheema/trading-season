-- Only for the freshly reset, disposable Jenkins stack.
BEGIN;
INSERT INTO stocks (symbol, company_name, starting_price, sector, average_volume, base_volatility)
VALUES ('CIEQ', 'CI Equity', 25, 'Technology', 1000, 0.01);
INSERT INTO instruments (ticker, name, asset_class, market, currency, is_tradable, simulated_stock_symbol)
VALUES ('CIEQ', 'CI Equity', 'Equity', 'US', 'USD', true, 'CIEQ');
DO $$
DECLARE
    fixture_session bigint;
BEGIN
    INSERT INTO simulation_sessions (seed, drift, config, started_at, ended_at, status)
    VALUES (1, 0, '{"tick_storage":{"mode":"postgres"}}',
            '2026-01-05 14:30:00+00', '2026-01-05 14:31:00+00', 'COMPLETED')
    RETURNING id INTO fixture_session;
    INSERT INTO candles (session_id, symbol, "interval", "timestamp", open, high, low, close, volume, trade_count)
    VALUES (fixture_session, 'CIEQ', '1m', '2026-01-05 14:30:00+00', 25, 25, 25, 25, 100, 1);
    INSERT INTO market_ticks (session_id, symbol, "timestamp", price, bid, ask, bid_size, ask_size, trade_volume, sequence_number)
    VALUES (fixture_session, 'CIEQ', '2026-01-05 14:30:00+00', 25, 24.99, 25.01, 100, 100, 100, 1);
END $$;
COMMIT;
