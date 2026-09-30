-- Add name column to accounts table
-- For existing accounts, backfill with 'Account' as the default name

ALTER TABLE accounts ADD COLUMN name TEXT NOT NULL DEFAULT 'Account';

-- Remove the default constraint so new rows must provide an explicit name
ALTER TABLE accounts ALTER COLUMN name DROP DEFAULT;
