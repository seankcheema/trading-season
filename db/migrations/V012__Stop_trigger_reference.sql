-- Submission reference_price/reference_at remain immutable audit context.
-- Legacy triggered orders retain their previous protection until resolved.
ALTER TABLE orders ADD COLUMN trigger_price NUMERIC(24,6);
ALTER TABLE orders ADD CONSTRAINT chk_order_trigger_price CHECK (trigger_price IS NULL OR trigger_price > 0);
