-- Apply after V001, as the database owner, for fresh and retained databases.
BEGIN;
SELECT pg_advisory_xact_lock(2026100402);
CREATE TABLE IF NOT EXISTS public.user_watchlist (
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(5) NOT NULL REFERENCES public.stocks(symbol) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, symbol)
);
COMMIT;
