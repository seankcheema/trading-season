-- Preserve account identities and all related history when accounts leave the active list.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
