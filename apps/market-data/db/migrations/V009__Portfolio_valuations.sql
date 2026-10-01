-- Real-time observations of account holdings; trade timestamps remain in fills/movements.
CREATE TABLE portfolio_valuations (
    valuation_id BIGSERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    portfolio_value NUMERIC(38,10) NOT NULL CHECK (portfolio_value >= 0)
);
CREATE INDEX portfolio_valuations_account_time
    ON portfolio_valuations (account_id, observed_at, valuation_id);
