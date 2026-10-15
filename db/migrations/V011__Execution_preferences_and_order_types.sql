-- Retained and fresh databases: preserve historical outcomes, add durable order instructions.
BEGIN;
SELECT pg_advisory_xact_lock(2026101501);
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE execution_buffer_percent > 10 OR execution_buffer_percent < 0) THEN
        RAISE EXCEPTION 'Execution buffer migration requires existing user percentages between 0 and 10; correct invalid preferences first';
    END IF;
END $$;
UPDATE users SET execution_buffer_percent = 1 WHERE execution_buffer_percent = 0;
ALTER TABLE users ALTER COLUMN execution_buffer_percent SET DEFAULT 1;
ALTER TABLE users DROP CONSTRAINT users_execution_buffer_percent_check;
ALTER TABLE users ADD CONSTRAINT users_execution_buffer_percent_check CHECK (execution_buffer_percent BETWEEN 0 AND 10);
ALTER TABLE orders ADD COLUMN execution_type text NOT NULL DEFAULT 'MARKET',
    ADD COLUMN limit_price numeric(18,6), ADD COLUMN stop_price numeric(18,6),
    ADD COLUMN reference_price numeric(18,6), ADD COLUMN reference_at timestamptz,
    ADD COLUMN session_id bigint REFERENCES simulation_sessions(id),
    ADD COLUMN triggered_at timestamptz, ADD COLUMN evaluated_at timestamptz,
    ADD COLUMN reserved_cash numeric(24,6) NOT NULL DEFAULT 0,
    ADD COLUMN reserved_shares numeric(14,4) NOT NULL DEFAULT 0,
    ADD COLUMN execution_price numeric(18,6), ADD COLUMN rejection_code text,
    ADD COLUMN retry_after timestamptz, ADD COLUMN execution_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING','ACCEPTED','FILLED','REJECTED','CANCELLED'));
ALTER TABLE orders ADD CONSTRAINT orders_execution_type_check CHECK (execution_type IN ('MARKET','LIMIT','STOP','STOP_LIMIT')),
    ADD CONSTRAINT orders_execution_prices_check CHECK (
        (limit_price IS NOT NULL) = (execution_type IN ('LIMIT','STOP_LIMIT')) AND
        (stop_price IS NOT NULL) = (execution_type IN ('STOP','STOP_LIMIT')) AND
        (limit_price IS NULL OR limit_price > 0) AND (stop_price IS NULL OR stop_price > 0)),
    ADD CONSTRAINT orders_reservations_check CHECK (reserved_cash >= 0 AND reserved_shares >= 0 AND
        (status = 'ACCEPTED' OR (reserved_cash = 0 AND reserved_shares = 0))),
    ADD CONSTRAINT orders_new_execution_context_check CHECK (reference_price IS NULL OR
        (reference_price > 0 AND reference_at IS NOT NULL AND session_id IS NOT NULL AND
         buffer_percent IS NOT NULL AND buffer_percent BETWEEN 0 AND 10 AND quantity = trunc(quantity)));
UPDATE orders o SET execution_price = f.quote_price FROM fills f WHERE f.order_id = o.order_id;
CREATE INDEX orders_open_execution_idx ON orders (session_id, order_id) WHERE status = 'ACCEPTED' AND reference_price IS NOT NULL;
COMMIT;
