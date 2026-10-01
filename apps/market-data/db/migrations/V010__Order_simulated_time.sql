-- Preserve real audit timestamps while recording the selected replay time.
ALTER TABLE orders ADD COLUMN simulated_at TIMESTAMPTZ;
