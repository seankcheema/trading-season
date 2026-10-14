-- Apply after V011, as the database owner, for fresh and retained databases.
-- BR-12: the platform prices every instrument class the firm supports at
-- launch (UK, US and Indian equities, foreign exchange, crypto) from the
-- simulated market. V001 allowed instruments.simulated_stock_symbol, the link
-- from an instrument to its simulated price series, only for US equities, so
-- no other class could be priced. The link now applies to every class; the
-- foreign key to stocks(symbol) and its uniqueness are unchanged. Safe to
-- reapply.
BEGIN;
SELECT pg_advisory_xact_lock(2026101301);
ALTER TABLE public.instruments DROP CONSTRAINT IF EXISTS instruments_check2;
COMMIT;
