-- V008: user_accounts stops carrying an activation state (DUA-29).
--
-- account_status has existed since V001 and moved to user_accounts in V005,
-- where it gated three things: sign-in, token refresh, and order placement.
-- V006 dropped the duplicate copy users had been carrying.
--
-- No business requirement asks for it. The LEAP Business Requirements
-- Specification covers identity and access in section 8.1: registration and
-- secure sign-in (BR-01), per-client data isolation (BR-02), and sessions that
-- are time-limited and revocable (BR-03). Fifteen-minute access tokens and
-- server-side refresh-token revocation already satisfy BR-03. Section 4.2 puts
-- client onboarding and identity verification beyond a working sign-in out of
-- scope for this phase, and no stakeholder in section 5 or persona in
-- section 6 administers client accounts.
--
-- Nothing ever wrote the column either. Outside of test fixtures and manual
-- SQL there was no way to deactivate an account, so the checks could only ever
-- pass. The dormant-account sweep that would have written it (KAN-92, noted
-- against users.last_activity_at in V001) was never built and is closed.
--
-- The inline CHECK (account_status IN ('ACTIVE', 'DEACTIVATED')) is unnamed and
-- belongs to the column; Postgres removes it along with the column, so there is
-- no separate DROP CONSTRAINT. No index references it.
--
-- Apply after V007. Destructive: unlike V006, these values survive nowhere.
-- Every account was ACTIVE, so nothing distinguishable is lost, but a future
-- activation feature starts from an empty column rather than this history.

BEGIN;

ALTER TABLE user_accounts
    DROP COLUMN IF EXISTS account_status;

COMMIT;
