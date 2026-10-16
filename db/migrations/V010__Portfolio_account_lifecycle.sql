ALTER TABLE accounts ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE accounts ADD COLUMN archived_at timestamptz;
ALTER TABLE accounts ADD CONSTRAINT accounts_lifecycle_check CHECK (
    (status = 'ACTIVE' AND archived_at IS NULL) OR
    (status = 'ARCHIVED' AND archived_at IS NOT NULL)
);
CREATE INDEX accounts_owner_status_idx ON accounts(user_id, status);
