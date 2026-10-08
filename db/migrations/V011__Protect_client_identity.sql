-- V011: make the client a trade record is attributed to permanent (DUA-68).
--
-- Business requirement BR-14: every accepted order, pricing decision and
-- resulting change to cash or holdings must be permanently recorded and
-- attributable to a specific client and time.
--
-- V010 fixed every record to an account and every account to a user id, but
-- left the user itself open: the users and user_accounts rows could be deleted
-- or rewritten, so a permanent record could end up pointing at a different
-- name, or at nobody. These triggers close that for every role, including the
-- table owner:
--
--   users
--       Never deleted. user_id, first_name, middle_name, last_name, ssn and
--       date_of_birth are fixed at registration. terms_accepted_at is written
--       once and then final.
--   user_accounts
--       Never deleted. user_id and email are fixed at sign-up.
--
-- Everything else stays mutable: address, trader level, settings, the cached
-- available_funds balance, password hash and sign-in lockout state. No service
-- changes a frozen column today; each is written once, at registration. A
-- future change-of-name or change-of-email feature needs a new migration that
-- records the history rather than overwriting it.
--
-- Deactivating or closing a client must therefore be a state change on a row
-- that stays, never a delete.
--
-- Apply after V010, as the database owner, for fresh and retained databases.
-- It reuses V010's reject_trade_record_change(). Safe to re-run.

BEGIN;
SELECT pg_advisory_xact_lock(2026100811);
SET LOCAL search_path TO public;

CREATE OR REPLACE FUNCTION guard_client_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.first_name IS DISTINCT FROM OLD.first_name
        OR NEW.middle_name IS DISTINCT FROM OLD.middle_name
        OR NEW.last_name IS DISTINCT FROM OLD.last_name
        OR NEW.ssn IS DISTINCT FROM OLD.ssn
        OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
        RAISE EXCEPTION 'The identity of user % cannot change', OLD.user_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF OLD.terms_accepted_at IS NOT NULL
        AND NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at THEN
        RAISE EXCEPTION 'The terms acceptance time of user % cannot change', OLD.user_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_client_login() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION 'The sign-in identity of user % cannot change', OLD.user_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- Users: the client every account, and so every record, resolves to.
CREATE OR REPLACE TRIGGER users_guard_identity
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION guard_client_identity();
CREATE OR REPLACE TRIGGER users_no_delete
    BEFORE DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER users_no_truncate
    BEFORE TRUNCATE ON users
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

-- User accounts: the email the client signed up and is contacted with.
CREATE OR REPLACE TRIGGER user_accounts_guard_login
    BEFORE UPDATE ON user_accounts
    FOR EACH ROW EXECUTE FUNCTION guard_client_login();
CREATE OR REPLACE TRIGGER user_accounts_no_delete
    BEFORE DELETE ON user_accounts
    FOR EACH ROW EXECUTE FUNCTION reject_trade_record_change();
CREATE OR REPLACE TRIGGER user_accounts_no_truncate
    BEFORE TRUNCATE ON user_accounts
    FOR EACH STATEMENT EXECUTE FUNCTION reject_trade_record_change();

COMMIT;
