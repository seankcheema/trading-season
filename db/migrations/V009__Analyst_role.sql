-- Apply after V008, as the database owner, for fresh and retained databases.
-- Adds the ANALYST role: the only role the Reporting Service serves report
-- runs to, and so the only one that can use the Reporting UI. V001's check
-- listed ADMIN and TRADER, so writing ANALYST to user_accounts.user_role was
-- refused. Existing rows are untouched and TRADER stays the default; an
-- account becomes an analyst only by an explicit update of this column.
-- Safe to reapply.
BEGIN;
SELECT pg_advisory_xact_lock(2026100801);
ALTER TABLE public.user_accounts DROP CONSTRAINT IF EXISTS user_accounts_user_role_check;
ALTER TABLE public.user_accounts ADD CONSTRAINT user_accounts_user_role_check
    CHECK (user_role = ANY (ARRAY['ADMIN'::text, 'TRADER'::text, 'ANALYST'::text]));
COMMIT;
