-- V010: make the trade record permanent (DUA-68).
--
-- Business requirement: every accepted order, pricing decision and resulting
-- change to cash or holdings must be permanently recorded and attributable to
-- a specific client and time. The record is the firm's legal position and
-- must survive any system restart or failed deployment.
--
-- PostgreSQL already makes committed rows durable across restarts, and order
-- execution writes the order, fill, cash and holding rows in one transaction.
-- What nothing enforced was permanence: any UPDATE, DELETE or TRUNCATE could
-- rewrite the record. These triggers make the record append-only for every
-- role, including the table owner, which the application connects as:
--
--   audit_trail, fills, cash_transactions, holding_movements
--       Insert only. UPDATE, DELETE and TRUNCATE are rejected.
--   orders
--       Insert, then resolve once. The terms the client submitted (account,
--       instrument, side, quantity, indicative price, buffer, client
--       reference, submission and simulated times) never change. A PENDING
--       order may be accepted and then resolved to FILLED or REJECTED; a
--       resolved order is final. DELETE and TRUNCATE are rejected.
--   accounts
--       May be renamed, but never deleted or moved to another user, because
--       an account's owner is how every order and ledger row is attributed
--       to a client.
--
-- users.available_funds and holdings stay mutable: both are cached balances
-- derived from the ledgers above, which remain the record.
--
-- Bypassing these guards needs a schema change (DROP TRIGGER, ALTER TABLE ...
-- DISABLE TRIGGER), which only the table owner can make. Separating the owner
-- role from the application role would close that path; see
-- docs/reference/trade-record.md.
--
-- Apply after V009, as the database owner, for fresh and retained databases.
-- Safe to re-run.

BEGIN;
SELECT pg_advisory_xact_lock(2026100610);
SET LOCAL search_path TO public;

CREATE OR REPLACE FUNCTION reject_trade_record_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% on % is not allowed: the trade record is permanent', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation',
              HINT = 'Record a new row instead of changing or removing an existing one.';
END;
$$;

CREATE OR REPLACE FUNCTION guard_order_record() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status IN ('FILLED', 'REJECTED') THEN
        RAISE EXCEPTION 'Order % is % and its record is final', OLD.order_id, OLD.status
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.account_id IS DISTINCT FROM OLD.account_id
        OR NEW.instrument_id IS DISTINCT FROM OLD.instrument_id
        OR NEW.client_reference IS DISTINCT FROM OLD.client_reference
        OR NEW.order_type IS DISTINCT FROM OLD.order_type
        OR NEW.quantity IS DISTINCT FROM OLD.quantity
        OR NEW.indicative_price IS DISTINCT FROM OLD.indicative_price
        OR NEW.buffer_percent IS DISTINCT FROM OLD.buffer_percent
        OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
        OR NEW.simulated_at IS DISTINCT FROM OLD.simulated_at THEN
        RAISE EXCEPTION 'The submitted terms of order % cannot change', OLD.order_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
        RAISE EXCEPTION 'The acceptance time of order % cannot change', OLD.order_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_account_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Account % cannot move to another user', OLD.account_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- Ledgers: insert only.
CREATE OR REPLACE TRIGGER audit_trail_append_only
    BEFORE UPDATE OR DELETE ON audit_trail
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER audit_trail_no_truncate
    BEFORE TRUNCATE ON audit_trail
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

CREATE OR REPLACE TRIGGER fills_append_only
    BEFORE UPDATE OR DELETE ON fills
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER fills_no_truncate
    BEFORE TRUNCATE ON fills
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

CREATE OR REPLACE TRIGGER cash_transactions_append_only
    BEFORE UPDATE OR DELETE ON cash_transactions
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER cash_transactions_no_truncate
    BEFORE TRUNCATE ON cash_transactions
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

CREATE OR REPLACE TRIGGER holding_movements_append_only
    BEFORE UPDATE OR DELETE ON holding_movements
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER holding_movements_no_truncate
    BEFORE TRUNCATE ON holding_movements
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

-- Orders: resolve once, never remove.
CREATE OR REPLACE TRIGGER orders_guard_update
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION guard_order_record();
CREATE OR REPLACE TRIGGER orders_no_delete
    BEFORE DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER orders_no_truncate
    BEFORE TRUNCATE ON orders
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

-- Accounts: the owner is how the record is attributed to a client.
CREATE OR REPLACE TRIGGER accounts_guard_owner
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION guard_account_owner();
CREATE OR REPLACE TRIGGER accounts_no_delete
    BEFORE DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER accounts_no_truncate
    BEFORE TRUNCATE ON accounts
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

COMMIT;
