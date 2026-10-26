-- Exact versions allow independent acknowledgments across devices and simulation rewinds.
CREATE TABLE dua_read_state (
    id varchar(64) PRIMARY KEY,
    user_id uuid NOT NULL,
    account_id integer NOT NULL REFERENCES accounts(account_id),
    session_id bigint NOT NULL,
    insight varchar(16) NOT NULL CHECK (insight IN ('stock', 'daily', 'holdings')),
    symbol varchar(32) NOT NULL,
    version varchar(4096) NOT NULL
);
CREATE INDEX dua_read_state_owner ON dua_read_state(user_id, account_id, session_id);
