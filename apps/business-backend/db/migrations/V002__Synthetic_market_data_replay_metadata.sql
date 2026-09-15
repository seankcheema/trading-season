-- Synthetic market data replay metadata and idempotent persistence constraints.
--
-- This incremental migration keeps V001 untouched while aligning the business
-- simulator tables with the synthetic market data replay storage contract.
-- Apply this after V001 and before importing the one-year market data archive.

ALTER TABLE simulation_sessions
    ADD COLUMN config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
    ADD COLUMN status TEXT NOT NULL DEFAULT 'CREATED'
        CHECK (status IN ('CREATED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'RESET')),
    ADD COLUMN failure_code TEXT,
    ADD COLUMN failure_detail TEXT;

ALTER TABLE simulation_sessions
    ADD CONSTRAINT simulation_sessions_terminal_end_time
        CHECK (status NOT IN ('COMPLETED', 'FAILED', 'RESET') OR ended_at IS NOT NULL),
    ADD CONSTRAINT simulation_sessions_failure_fields
        CHECK (status = 'FAILED' OR (failure_code IS NULL AND failure_detail IS NULL));

ALTER TABLE market_ticks
    DROP CONSTRAINT market_ticks_session_symbol_sequence_unique,
    ADD CONSTRAINT market_ticks_session_sequence_unique UNIQUE (session_id, sequence_number);

ALTER TABLE quotes
    ADD CONSTRAINT quotes_session_symbol_timestamp_unique
        UNIQUE (session_id, symbol, "timestamp");

DROP INDEX IF EXISTS idx_quotes_session_symbol_timestamp;
DROP INDEX IF EXISTS idx_candles_session_symbol_interval_timestamp;

CREATE INDEX idx_simulation_sessions_created_id
    ON simulation_sessions (created_at DESC, id DESC);
CREATE INDEX idx_simulation_sessions_active_status
    ON simulation_sessions (status)
    WHERE status IN ('CREATED', 'RUNNING', 'PAUSED');
CREATE INDEX idx_market_ticks_session_symbol_sequence
    ON market_ticks (session_id, symbol, sequence_number);
