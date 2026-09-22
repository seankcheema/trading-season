-- V003: the business backend authenticates requests with access tokens issued by
-- the auth service (KAN-123) and no longer stores credentials or login sessions.
-- Accounts are identified by email; usernames are no longer collected.
--
-- users.user_id now holds the auth service's user UUID, carried as the token's
-- sub claim, and is set by the application at registration rather than generated.
-- Passwords, lockout state, password reset and login history belong to the auth
-- database. Revocable sessions (BR-03) are the auth service's refresh tokens.
--
-- Apply after V002. This drops columns and a table: any stored password hashes,
-- lockout state and sessions are discarded.

BEGIN;

DROP TABLE IF EXISTS sessions;

ALTER TABLE users
    ALTER COLUMN user_id DROP DEFAULT,
    DROP COLUMN IF EXISTS username,
    DROP COLUMN IF EXISTS password_hash,
    DROP COLUMN IF EXISTS failed_login_attempts,
    DROP COLUMN IF EXISTS locked_until,
    DROP COLUMN IF EXISTS reset_token,
    DROP COLUMN IF EXISTS reset_token_expires_at,
    DROP COLUMN IF EXISTS last_login_at;

-- Registration and the account existence check compare emails ignoring case.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

COMMIT;
