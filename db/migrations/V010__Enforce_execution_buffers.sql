ALTER TABLE users ALTER COLUMN execution_buffer_percent SET DEFAULT 1;
UPDATE users SET execution_buffer_percent = 1 WHERE execution_buffer_percent = 0;
ALTER TABLE orders ADD COLUMN session_id bigint;
ALTER TABLE orders ADD COLUMN executed_simulated_at timestamptz;
