-- V004: order lifecycle statuses confirmed by KAN-93 (buy/sell order API).
--
-- V001 listed SUBMITTED -> ACCEPTED/REJECTED -> FILLED/EXECUTION_FAILED as an
-- open assumption. The confirmed lifecycle is:
--   PENDING -> REJECTED   a trading rule failed (insufficient funds,
--                         insufficient holdings, untradable, inactive)
--   PENDING -> FILLED     the fill was written and the funds and holdings
--                         moved; FILLED is the final state of a successful order
-- PENDING is the status an order is created with, before any rule runs.
--
-- Buy orders check and debit users.available_funds; sell orders credit it.
-- Cash belongs to the user, not to an account: accounts.cash_balance is no
-- longer moved by order execution. cash_transactions rows are still written for
-- every fill.
--
-- Apply after V003. Existing order rows are mapped onto the new lifecycle.
-- audit_trail is insert-only, so its historical rows are left as recorded and
-- its constraint keeps the pre-V004 event types alongside the new ones.

BEGIN;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders
SET status = CASE status
    WHEN 'SUBMITTED'        THEN 'PENDING'
    WHEN 'ACCEPTED'         THEN 'PENDING'
    WHEN 'APPROVED'         THEN 'FILLED'
    WHEN 'EXECUTION_FAILED' THEN 'REJECTED'
    ELSE status
END
WHERE status IN ('SUBMITTED', 'ACCEPTED', 'APPROVED', 'EXECUTION_FAILED');

ALTER TABLE orders
    ALTER COLUMN status SET DEFAULT 'PENDING',
    ADD CONSTRAINT orders_status_check
        CHECK (status IN ('PENDING', 'FILLED', 'REJECTED'));

ALTER TABLE audit_trail DROP CONSTRAINT IF EXISTS audit_trail_event_type_check;

-- SUBMITTED, ACCEPTED, APPROVED and EXECUTION_FAILED are kept only so rows
-- recorded before V004 stay valid; the application never writes them.
ALTER TABLE audit_trail
    ADD CONSTRAINT audit_trail_event_type_check
        CHECK (event_type IN ('PENDING', 'FILLED', 'REJECTED',
                              'SUBMITTED', 'ACCEPTED', 'APPROVED', 'EXECUTION_FAILED'));

COMMIT;
