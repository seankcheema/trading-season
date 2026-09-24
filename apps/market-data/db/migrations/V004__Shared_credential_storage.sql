-- V004: the auth service no longer has a database of its own (KAN-45/KAN-143).
-- It reads and writes the credential columns of this users table and owns
-- refresh_tokens here, so a user is one row rather than two rows in two
-- databases joined by a UUID.
--
-- This partly reverses V003. V003 moved passwords and lockout state out on the
-- premise that they lived in a separate auth database; that database is gone,
-- so the columns come back. What V003 established still holds: users.user_id
-- is the auth service's UUID, carried as the token's sub claim and set by the
-- application at registration.
--
-- Column ownership after this migration:
--   auth service writes  user_id, email, password_hash, failed_login_attempts,
--                        locked_until, updated_at
--   auth service reads   user_role, account_status
--   Java services write  the profile columns, and read email
-- No column is written by both.
--
-- Apply after V003. Additive except for the five NOT NULL constraints dropped
-- below; no data is discarded.

BEGIN;

ALTER TABLE users
    -- Nullable, not NOT NULL: rows created before this migration have no hash,
    -- and a NOT NULL would fail outright. The auth service always sets it at
    -- registration, so rows created from here on always carry one.
    ADD COLUMN IF NOT EXISTS password_hash         TEXT,

    -- Lockout state (KAN-84), read by the auth service's five-strike rule.
    -- Safe as NOT NULL: the default backfills every existing row.
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ,

    -- Maintained by the auth service only. The Java entities do not map this
    -- column, so it tracks credential changes rather than every write to the
    -- row. Making it cover both would need a trigger.
    ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT now();

-- Registration is two steps: the auth service inserts the credentials, then the
-- profile is completed against the same row. The first step supplies none of
-- these, so the database can no longer require them. Completeness of a profile
-- is now enforced by the registration flow, not by the schema.
ALTER TABLE users
    ALTER COLUMN first_name    DROP NOT NULL,
    ALTER COLUMN last_name     DROP NOT NULL,
    ALTER COLUMN ssn           DROP NOT NULL,
    ALTER COLUMN address       DROP NOT NULL,
    ALTER COLUMN date_of_birth DROP NOT NULL;

-- Revocable sessions (BR-03). Only the SHA-256 hash of a refresh token is
-- stored; the raw value is returned to the client once and never persisted, so
-- a database leak does not hand over live sessions.
--
-- Column and index names match the auth service's TypeORM entity exactly.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A real foreign key, which was impossible while this table lived in a
    -- separate database. CASCADE is a backstop: the auth service deactivates
    -- accounts rather than deleting them, so it should never fire.
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    token_hash  TEXT NOT NULL UNIQUE,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,

    -- Set on logout, on rotation, and when a rotated token is replayed.
    revoked_at  TIMESTAMPTZ,

    -- The token that superseded this one. Deliberately not a foreign key:
    -- it records history, and a constraint here would block expiring old rows.
    replaced_by UUID
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

COMMIT;
