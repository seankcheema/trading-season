-- Apply after V012, as the database owner, for fresh and retained databases.
-- BR-10 and section 9.1: a deposit or withdrawal the client retries must post
-- once. Each POST /api/me/cash-transactions now carries a client reference,
-- stored here so a repeat of the same reference returns the original row
-- instead of moving the cash again; the unique constraint is the backstop for
-- two concurrent retries. Order fills and existing rows keep a null reference,
-- which the constraint treats as distinct. Safe to reapply.
BEGIN;
SELECT pg_advisory_xact_lock(2026101601);
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS client_reference uuid;
ALTER TABLE public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_client_reference_key;
ALTER TABLE public.cash_transactions ADD CONSTRAINT cash_transactions_client_reference_key UNIQUE (client_reference);
COMMIT;
