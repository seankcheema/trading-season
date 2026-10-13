-- V009: record each client's acceptance of the platform terms (DUA-75).
--
-- A client must accept the TradingSeason Terms and Conditions before using the
-- dashboard. Each acceptance is its own row: who accepted, which version of the
-- terms, and when. The primary key allows one row per client and version, so
-- accepting the same version twice changes nothing and the first timestamp
-- stands. Publishing a new version of the terms needs no schema change: clients
-- simply have no row for it yet and are asked again.
--
-- The foreign key has no ON DELETE CASCADE, unlike user_watchlist. A watchlist
-- is a preference; an acceptance is a record, and it must not disappear because
-- the client it belongs to was removed.
--
-- Holdings and Trade Service is the only writer. Rows are inserted and never
-- updated.
--
-- Apply after V008, as the database owner, for fresh and retained databases.
-- Adds one table and changes no existing rows. Safe to reapply.
BEGIN;
SELECT pg_advisory_xact_lock(2026101201);
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
    user_id UUID NOT NULL REFERENCES public.users(user_id),
    terms_version TEXT NOT NULL CHECK (terms_version <> ''),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, terms_version)
);
COMMIT;
