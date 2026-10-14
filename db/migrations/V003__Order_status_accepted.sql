-- Apply after V002, as the database owner, for fresh and retained databases.
-- BR-06: an order that passed the trading rules is committed as ACCEPTED
-- before execution runs in its own transaction. V001's check listed only the
-- three original statuses, so the ACCEPTED write was refused. Safe to reapply.
BEGIN;
SELECT pg_advisory_xact_lock(2026100601);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
    CHECK (status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'FILLED'::text, 'REJECTED'::text]));
COMMIT;
