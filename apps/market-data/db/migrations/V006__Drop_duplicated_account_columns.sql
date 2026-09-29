-- V006: users stops carrying copies of columns user_accounts owns
-- (KAN-45/KAN-143).
--
-- V005 moved credentials and access state into user_accounts but left three
-- columns behind on users, because the Java services still read them. They now
-- read the account record instead, so the copies can go.
--
-- The copies were not merely redundant, they were wrong. Nothing updated
-- users.account_status after registration, so deactivating an account changed
-- user_accounts while users kept reporting ACTIVE. Order validation read the
-- stale one, and a deactivated trader could keep placing orders.
--
--   user_role       replaced by user_accounts.user_role
--   account_status  replaced by user_accounts.account_status
--   email           replaced by user_accounts.email, which carries the
--                   case-insensitive unique index sign-in relies on
--
-- Dropping users.email also drops users_email_lower_key, created by V003, and
-- the UNIQUE constraint users.email carried from V001. Postgres removes both
-- with the column; neither is needed once user_accounts_email_lower_key is the
-- one index enforcing that an address registers once.
--
-- Apply after V005. Destructive: these three columns and their data are gone.
-- The values survive in user_accounts, which is where they were being written.

BEGIN;

ALTER TABLE users
    DROP COLUMN IF EXISTS user_role,
    DROP COLUMN IF EXISTS account_status,
    DROP COLUMN IF EXISTS email;

COMMIT;
