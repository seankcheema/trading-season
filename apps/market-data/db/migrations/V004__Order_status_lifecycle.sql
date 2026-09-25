-- V004: order lifecycle statuses confirmed by KAN-93 (buy/sell order API).
--
-- V001 listed SUBMITTED -> ACCEPTED/REJECTED -> FILLED/EXECUTION_FAILED as an
-- open assumption. The confirmed lifecycle is:
--   PENDING -> REJECTED             a trading rule failed (insufficient funds,
--                                   insufficient holdings, untradable, inactive)
--   PENDING -> FILLED -> APPROVED   the fill was written and the funds and
--                                   holdings moved; APPROVED is the final state
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
    WHEN 'FILLED'           THEN 'APPROVED'
    WHEN 'EXECUTION_FAILED' THEN 'REJECTED'
    ELSE status
END
WHERE status IN ('SUBMITTED', 'ACCEPTED', 'FILLED', 'EXECUTION_FAILED');

ALTER TABLE orders
    ALTER COLUMN status SET DEFAULT 'PENDING',
    ADD CONSTRAINT orders_status_check
        CHECK (status IN ('PENDING', 'FILLED', 'APPROVED', 'REJECTED'));

ALTER TABLE audit_trail DROP CONSTRAINT IF EXISTS audit_trail_event_type_check;

-- SUBMITTED, ACCEPTED and EXECUTION_FAILED remain only for rows recorded before V004.
ALTER TABLE audit_trail
    ADD CONSTRAINT audit_trail_event_type_check
        CHECK (event_type IN ('PENDING', 'FILLED', 'APPROVED', 'REJECTED',
                              'SUBMITTED', 'ACCEPTED', 'EXECUTION_FAILED'));

COMMIT;
