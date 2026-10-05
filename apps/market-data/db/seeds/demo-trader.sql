-- Development-only, additive seed. Requires V001-V010 and imported 1m candles.
-- Run the entire file in pgAdmin Query Tool or with psql -v ON_ERROR_STOP=1 -f.
-- The development login uses a precomputed bcrypt hash.
-- Prices are simulation archive prices, not real exchange history.
BEGIN;
SELECT pg_advisory_xact_lock(20261001, 63);
CREATE TEMP TABLE demo_seed_options ON COMMIT DROP AS
-- Leave password empty to use the supplied development login password.
-- Change session_id here if your imported archive uses another session.
SELECT ''::text AS password, 2026001::bigint AS session_id;

CREATE TEMP TABLE demo_trade_plan (
    sequence integer GENERATED ALWAYS AS IDENTITY,
    requested_at timestamp NOT NULL,
    symbol text NOT NULL,
    side text NOT NULL,
    quantity integer NOT NULL
) ON COMMIT DROP;

-- Build a diversified starting portfolio, then accumulate and trim monthly.
INSERT INTO demo_trade_plan (requested_at, symbol, side, quantity) VALUES
 ('2026-01-05 09:45', 'AAPL', 'BUY', 20),
 ('2026-01-05 09:46', 'MSFT', 'BUY', 10),
 ('2026-01-05 09:47', 'NVDA', 'BUY', 8),
 ('2026-01-05 09:48', 'JPM',  'BUY', 20),
 ('2026-01-05 09:49', 'XOM',  'BUY', 30),
 ('2026-01-05 09:50', 'TSLA', 'BUY', 8);

INSERT INTO demo_trade_plan (requested_at, symbol, side, quantity)
SELECT month + activity.offset_days * interval '1 day' + activity.at_time,
       activity.symbol, activity.side, activity.quantity
FROM generate_series(timestamp '2026-02-01', timestamp '2026-09-01', interval '1 month') AS months(month)
CROSS JOIN LATERAL (VALUES
 (4, interval '9 hours 45 minutes', 'AAPL', 'BUY', 4),
 (4, interval '9 hours 46 minutes', 'MSFT', 'BUY', 2),
 (4, interval '9 hours 47 minutes', CASE WHEN extract(month FROM month)::integer % 2 = 0 THEN 'JPM' ELSE 'XOM' END, 'BUY', CASE WHEN extract(month FROM month)::integer % 2 = 0 THEN 3 ELSE 4 END),
 (18, interval '13 hours 15 minutes', 'AAPL', 'SELL', 2),
 (18, interval '13 hours 16 minutes', 'NVDA', 'SELL', 1)
) AS activity(offset_days, at_time, symbol, side, quantity)
ORDER BY month, activity.offset_days, activity.at_time;

-- Rotation includes complete liquidation and a later re-entry.
INSERT INTO demo_trade_plan (requested_at, symbol, side, quantity) VALUES
 ('2026-04-29 13:15', 'TSLA', 'SELL', 8),
 ('2026-07-20 09:45', 'TSLA', 'BUY', 5),
 ('2026-09-24 13:15', 'TSLA', 'SELL', 5),
 ('2026-10-01 09:45', 'AAPL', 'BUY', 4),
 ('2026-10-01 09:46', 'NVDA', 'BUY', 2);

DO $seed$
DECLARE
    demo_user constant uuid := '646a90d6-a9e7-4eb2-bb0d-83b71a212063';
    demo_email constant text := 'johndoe@gmail.com';
    demo_name constant text := '2026 Trading Demo';
    seed_session bigint;
    seed_password text;
    default_password_hash constant text := '$2b$10$mstlkBPVWB6WjAKMpLUAf.cP2wfE5xeD7E755e79.4QjTYtoqmYg2';
    seeded_account integer;
    execution_order integer;
    execution_fill integer;
    cash numeric := 50000.00;
    position numeric;
    delta numeric;
    amount numeric;
    trade record;
    observed_at timestamptz := clock_timestamp();
BEGIN
    SELECT password, session_id INTO seed_password, seed_session FROM demo_seed_options;
    IF seed_password <> '' AND (char_length(seed_password) < 8 OR octet_length(seed_password) > 72) THEN
        RAISE EXCEPTION 'Dummy password must contain at least 8 characters and at most 72 UTF-8 bytes';
    END IF;
    IF EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = demo_email AND user_id <> demo_user)
       OR EXISTS (SELECT 1 FROM user_accounts WHERE user_id = demo_user AND lower(email) <> demo_email) THEN
        RAISE EXCEPTION 'Demo identity conflicts with an existing login; no data changed';
    END IF;
    IF EXISTS (SELECT 1 FROM user_accounts WHERE user_id = demo_user) THEN
        IF EXISTS (SELECT 1 FROM accounts WHERE user_id = demo_user AND name = demo_name) THEN
            RAISE NOTICE 'Demo already exists; leaving credentials, balances, and later trades untouched';
            RETURN;
        END IF;
        RAISE EXCEPTION 'Demo identity exists without its seeded account; refusing to overwrite it';
    END IF;

    -- Resolve the first available bucket on or after each requested time. Weekend
    -- requests move to the next archived session, never an invented price/date.
    CREATE TEMP TABLE demo_executions ON COMMIT DROP AS
    SELECT plan.*, instrument.instrument_id,
           bucket.close AS price, bucket."timestamp" + interval '1 minute' AS simulated_at
    FROM demo_trade_plan plan
    LEFT JOIN instruments instrument ON instrument.simulated_stock_symbol = plan.symbol
                                       AND instrument.is_tradable
    LEFT JOIN LATERAL (
        SELECT candle."timestamp", candle.close
        FROM candles candle
        WHERE candle.session_id = seed_session AND candle.symbol = plan.symbol
          AND candle."interval" = '1m'
          AND candle."timestamp" >= plan.requested_at AT TIME ZONE 'America/Chicago'
          AND candle."timestamp" < (plan.requested_at + interval '7 days') AT TIME ZONE 'America/Chicago'
          AND candle."timestamp" + interval '1 minute' < timestamp '2026-10-02' AT TIME ZONE 'America/Chicago'
        ORDER BY candle."timestamp" LIMIT 1
    ) bucket ON true;
    IF EXISTS (SELECT 1 FROM demo_executions WHERE price IS NULL OR instrument_id IS NULL) THEN
        RAISE EXCEPTION 'Import Jan-Oct 1, 2026 one-minute candles and tradable instruments for AAPL, MSFT, NVDA, JPM, XOM, TSLA in session % first; no seed data written', seed_session;
    END IF;

    INSERT INTO user_accounts (user_id, email, password_hash, user_role, account_status)
    VALUES (demo_user, demo_email, CASE WHEN seed_password = '' THEN default_password_hash
            ELSE crypt(seed_password, gen_salt('bf', 10)) END, 'TRADER', 'ACTIVE');
    INSERT INTO users (user_id, first_name, last_name, ssn, address, date_of_birth,
                       trader_level, available_funds, last_activity_at)
    VALUES (demo_user, 'John', 'Doe', '000-00-0000', 'Development demo profile',
            date '1990-01-01', 'INTERMEDIATE', cash, observed_at);
    INSERT INTO accounts (user_id, name, opened_date, currency, cash_balance)
    VALUES (demo_user, demo_name, date '2026-01-01', 'USD', 0)
    RETURNING account_id INTO seeded_account;
    INSERT INTO cash_transactions (account_id, amount, reason, created_at)
    VALUES (seeded_account, cash, 'DEPOSIT', observed_at);

    FOR trade IN SELECT * FROM demo_executions ORDER BY simulated_at, sequence LOOP
        SELECT coalesce((SELECT quantity FROM holdings WHERE account_id = seeded_account
                         AND instrument_id = trade.instrument_id), 0) INTO position;
        delta := CASE WHEN trade.side = 'BUY' THEN trade.quantity ELSE -trade.quantity END;
        amount := round(trade.quantity * trade.price, 2);
        IF (trade.side = 'BUY' AND cash < amount) OR position + delta < 0 THEN
            RAISE EXCEPTION 'Seed exceeds cash or shares at % % %; transaction rolled back', trade.simulated_at, trade.side, trade.symbol;
        END IF;
        INSERT INTO orders (account_id, instrument_id, client_reference, order_type, status,
                            quantity, indicative_price, buffer_percent, submitted_at, resolved_at, simulated_at)
        VALUES (seeded_account, trade.instrument_id,
                md5('demo-trader-2026:' || trade.sequence)::uuid, trade.side, 'FILLED',
                trade.quantity, trade.price, 0, observed_at, observed_at, trade.simulated_at)
        RETURNING order_id INTO execution_order;
        INSERT INTO fills (order_id, quote_price, quantity, filled_at)
        VALUES (execution_order, trade.price, trade.quantity, observed_at)
        RETURNING fill_id INTO execution_fill;
        amount := CASE WHEN trade.side = 'BUY' THEN -amount ELSE amount END;
        cash := cash + amount;
        INSERT INTO cash_transactions (account_id, fill_id, amount, reason, created_at)
        VALUES (seeded_account, execution_fill, amount, 'ORDER_FILL', observed_at);
        INSERT INTO holding_movements (account_id, instrument_id, fill_id, quantity_delta, created_at)
        VALUES (seeded_account, trade.instrument_id, execution_fill, delta, observed_at);
        INSERT INTO holdings (account_id, instrument_id, quantity, updated_at)
        VALUES (seeded_account, trade.instrument_id, delta, observed_at)
        ON CONFLICT (account_id, instrument_id) DO UPDATE
        SET quantity = holdings.quantity + excluded.quantity, updated_at = excluded.updated_at;
        INSERT INTO audit_trail (order_id, event_type, detail, recorded_at) VALUES
         (execution_order, 'PENDING', 'Development seed: historical simulated order', observed_at),
         (execution_order, 'FILLED', 'Development seed: archived candle close at completed minute', observed_at);
    END LOOP;
    UPDATE users SET available_funds = cash WHERE user_id = demo_user;
    -- Historical graphs reconstruct positions from simulated_at and replay candles.
    -- Do not backdate real audit timestamps or manufacture valuation observations.
    RAISE NOTICE 'Created % with % filled orders and $% available funds', demo_email,
                 (SELECT count(*) FROM orders WHERE account_id = seeded_account), cash;
END
$seed$;
COMMIT;

SELECT login.email, account.account_id, account.name, profile.available_funds,
       count(instruction.order_id) AS filled_orders,
       min(instruction.simulated_at) AS first_trade, max(instruction.simulated_at) AS last_trade
FROM user_accounts login JOIN users profile USING (user_id) JOIN accounts account USING (user_id)
LEFT JOIN orders instruction USING (account_id)
WHERE login.user_id = '646a90d6-a9e7-4eb2-bb0d-83b71a212063'
GROUP BY login.email, account.account_id, account.name, profile.available_funds;
