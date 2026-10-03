-- Canonical Trading Season schema. Fresh databases only.
-- Apply once as the database owner; existing application data is never dropped.
BEGIN;
SELECT pg_advisory_xact_lock(2026100301);
SET LOCAL search_path TO public;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind IN ('r','p','v','m','f','S')) THEN
  RAISE EXCEPTION 'Setup requires an empty public schema; existing data was not changed';
 END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE accounts_account_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE audit_trail_audit_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE candles_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE cash_transactions_cash_transaction_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE fills_fill_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE holding_movements_holding_movement_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE holdings_holding_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE instruments_instrument_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE market_behaviors_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE market_states_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE market_ticks_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE orders_order_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE portfolio_valuations_valuation_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE quotes_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE simulation_sessions_id_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE TABLE accounts (
    "account_id" integer DEFAULT nextval('accounts_account_id_seq'::regclass) NOT NULL,
    "user_id" uuid NOT NULL,
    "cash_balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "opened_date" date DEFAULT CURRENT_DATE NOT NULL,
    "currency" text DEFAULT 'USD'::text NOT NULL,
    "name" text NOT NULL
);

CREATE TABLE audit_trail (
    "audit_id" integer DEFAULT nextval('audit_trail_audit_id_seq'::regclass) NOT NULL,
    "order_id" integer NOT NULL,
    "event_type" text NOT NULL,
    "detail" text,
    "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE candles (
    "id" bigint DEFAULT nextval('candles_id_seq'::regclass) NOT NULL,
    "session_id" bigint NOT NULL,
    "symbol" character varying(5) NOT NULL,
    "interval" text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "open" numeric(18,6) NOT NULL,
    "high" numeric(18,6) NOT NULL,
    "low" numeric(18,6) NOT NULL,
    "close" numeric(18,6) NOT NULL,
    "volume" bigint NOT NULL,
    "trade_count" integer NOT NULL
);

CREATE TABLE cash_transactions (
    "cash_transaction_id" integer DEFAULT nextval('cash_transactions_cash_transaction_id_seq'::regclass) NOT NULL,
    "account_id" integer NOT NULL,
    "fill_id" integer,
    "amount" numeric(14,2) NOT NULL,
    "reason" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE fills (
    "fill_id" integer DEFAULT nextval('fills_fill_id_seq'::regclass) NOT NULL,
    "order_id" integer NOT NULL,
    "quote_price" numeric(18,6) NOT NULL,
    "quantity" numeric(14,4) NOT NULL,
    "filled_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE holding_movements (
    "holding_movement_id" integer DEFAULT nextval('holding_movements_holding_movement_id_seq'::regclass) NOT NULL,
    "account_id" integer NOT NULL,
    "instrument_id" integer NOT NULL,
    "fill_id" integer NOT NULL,
    "quantity_delta" numeric(14,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE holdings (
    "holding_id" integer DEFAULT nextval('holdings_holding_id_seq'::regclass) NOT NULL,
    "account_id" integer NOT NULL,
    "instrument_id" integer NOT NULL,
    "quantity" numeric(14,4) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE instruments (
    "instrument_id" integer DEFAULT nextval('instruments_instrument_id_seq'::regclass) NOT NULL,
    "ticker" text NOT NULL,
    "name" text NOT NULL,
    "asset_class" text NOT NULL,
    "market" text,
    "currency" text NOT NULL,
    "is_tradable" boolean DEFAULT true NOT NULL,
    "simulated_stock_symbol" character varying(5)
);

CREATE TABLE market_behaviors (
    "id" bigint DEFAULT nextval('market_behaviors_id_seq'::regclass) NOT NULL,
    "session_id" bigint NOT NULL,
    "symbol" character varying(5) NOT NULL,
    "behavior_type" text NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "duration_seconds" numeric NOT NULL,
    "strength" numeric(5,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE market_states (
    "id" bigint DEFAULT nextval('market_states_id_seq'::regclass) NOT NULL,
    "session_id" bigint NOT NULL,
    "symbol" character varying(5) NOT NULL,
    "trend" text NOT NULL,
    "volatility" numeric(18,6) NOT NULL,
    "liquidity" numeric(5,4) NOT NULL,
    "momentum" numeric(5,4) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE market_ticks (
    "id" bigint DEFAULT nextval('market_ticks_id_seq'::regclass) NOT NULL,
    "session_id" bigint NOT NULL,
    "symbol" character varying(5) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "price" numeric(18,6) NOT NULL,
    "bid" numeric(18,6) NOT NULL,
    "ask" numeric(18,6) NOT NULL,
    "bid_size" integer NOT NULL,
    "ask_size" integer NOT NULL,
    "trade_volume" integer NOT NULL,
    "sequence_number" bigint NOT NULL
);

CREATE TABLE orders (
    "order_id" integer DEFAULT nextval('orders_order_id_seq'::regclass) NOT NULL,
    "account_id" integer NOT NULL,
    "instrument_id" integer NOT NULL,
    "client_reference" uuid NOT NULL,
    "order_type" text NOT NULL,
    "status" text DEFAULT 'PENDING'::text NOT NULL,
    "quantity" numeric(14,4) NOT NULL,
    "indicative_price" numeric(18,6),
    "buffer_percent" numeric(5,2),
    "rejection_reason" text,
    "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "accepted_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "simulated_at" timestamp with time zone
);

CREATE TABLE portfolio_valuations (
    "valuation_id" bigint DEFAULT nextval('portfolio_valuations_valuation_id_seq'::regclass) NOT NULL,
    "account_id" integer NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "portfolio_value" numeric(38,10) NOT NULL
);

CREATE TABLE quotes (
    "id" bigint DEFAULT nextval('quotes_id_seq'::regclass) NOT NULL,
    "session_id" bigint NOT NULL,
    "symbol" character varying(5) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "bid" numeric(18,6) NOT NULL,
    "ask" numeric(18,6) NOT NULL,
    "bid_size" integer NOT NULL,
    "ask_size" integer NOT NULL
);

CREATE TABLE refresh_tokens (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "token_hash" text NOT NULL,
    "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "replaced_by" uuid
);

CREATE TABLE simulation_sessions (
    "id" bigint DEFAULT nextval('simulation_sessions_id_seq'::regclass) NOT NULL,
    "seed" integer NOT NULL,
    "drift" double precision NOT NULL,
    "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "config_version" integer DEFAULT 1 NOT NULL,
    "status" text DEFAULT 'CREATED'::text NOT NULL,
    "failure_code" text,
    "failure_detail" text
);

CREATE TABLE stocks (
    "symbol" character varying(5) NOT NULL,
    "company_name" text NOT NULL,
    "starting_price" numeric(18,6) NOT NULL,
    "sector" text NOT NULL,
    "average_volume" bigint NOT NULL,
    "base_volatility" numeric(18,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE user_accounts (
    "user_id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "user_role" text DEFAULT 'TRADER'::text NOT NULL,
    "account_status" text DEFAULT 'ACTIVE'::text NOT NULL,
    "failed_login_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE users (
    "user_id" uuid NOT NULL,
    "first_name" text NOT NULL,
    "middle_name" text,
    "last_name" text NOT NULL,
    "ssn" text NOT NULL,
    "address" text NOT NULL,
    "date_of_birth" date NOT NULL,
    "trader_level" text DEFAULT 'BEGINNER'::text NOT NULL,
    "available_funds" numeric(14,2) DEFAULT 0 NOT NULL,
    "session_timeout_minutes" integer DEFAULT 10 NOT NULL,
    "execution_buffer_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE accounts ADD CONSTRAINT accounts_cash_balance_check CHECK ((cash_balance >= (0)::numeric));





ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (account_id);



ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_event_type_check CHECK ((event_type = ANY (ARRAY['PENDING'::text, 'FILLED'::text, 'REJECTED'::text, 'SUBMITTED'::text, 'ACCEPTED'::text, 'APPROVED'::text, 'EXECUTION_FAILED'::text])));



ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (audit_id);


ALTER TABLE candles ADD CONSTRAINT candles_close_check CHECK ((close > (0)::numeric));


ALTER TABLE candles ADD CONSTRAINT candles_high_check CHECK ((high > (0)::numeric));

ALTER TABLE candles ADD CONSTRAINT candles_high_is_max CHECK ((high = GREATEST(open, high, low, close)));



ALTER TABLE candles ADD CONSTRAINT candles_interval_check CHECK (("interval" ~ '^[1-9][0-9]*(s|m|h|d)$'::text));


ALTER TABLE candles ADD CONSTRAINT candles_low_check CHECK ((low > (0)::numeric));

ALTER TABLE candles ADD CONSTRAINT candles_low_is_min CHECK ((low = LEAST(open, high, low, close)));

ALTER TABLE candles ADD CONSTRAINT candles_low_lower_than_high CHECK ((low <= high));


ALTER TABLE candles ADD CONSTRAINT candles_open_check CHECK ((open > (0)::numeric));


ALTER TABLE candles ADD CONSTRAINT candles_pkey PRIMARY KEY (id);


ALTER TABLE candles ADD CONSTRAINT candles_session_symbol_interval_timestamp_unique UNIQUE (session_id, symbol, "interval", "timestamp");



ALTER TABLE candles ADD CONSTRAINT candles_trade_count_check CHECK ((trade_count > 0));


ALTER TABLE candles ADD CONSTRAINT candles_volume_check CHECK ((volume > 0));





ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_check CHECK (((reason = 'ORDER_FILL'::text) = (fill_id IS NOT NULL)));


ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_fill_id_key UNIQUE (fill_id);

ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (cash_transaction_id);

ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_reason_check CHECK ((reason = ANY (ARRAY['ORDER_FILL'::text, 'DEPOSIT'::text, 'WITHDRAWAL'::text])));




ALTER TABLE fills ADD CONSTRAINT fills_order_id_key UNIQUE (order_id);


ALTER TABLE fills ADD CONSTRAINT fills_pkey PRIMARY KEY (fill_id);

ALTER TABLE fills ADD CONSTRAINT fills_quantity_check CHECK ((quantity > (0)::numeric));


ALTER TABLE fills ADD CONSTRAINT fills_quote_price_check CHECK ((quote_price > (0)::numeric));




ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_fill_id_key UNIQUE (fill_id);




ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_pkey PRIMARY KEY (holding_movement_id);

ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_quantity_delta_check CHECK ((quantity_delta <> (0)::numeric));


ALTER TABLE holdings ADD CONSTRAINT holdings_account_id_instrument_id_key UNIQUE (account_id, instrument_id);




ALTER TABLE holdings ADD CONSTRAINT holdings_pkey PRIMARY KEY (holding_id);



ALTER TABLE instruments ADD CONSTRAINT instruments_asset_class_check CHECK ((asset_class = ANY (ARRAY['Equity'::text, 'FX'::text, 'Crypto'::text])));


ALTER TABLE instruments ADD CONSTRAINT instruments_check CHECK (((asset_class <> 'Equity'::text) OR (ticker ~ '^[A-Z][A-Z0-9.]{0,4}$'::text)));

ALTER TABLE instruments ADD CONSTRAINT instruments_check1 CHECK (((asset_class = 'Equity'::text) = (market IS NOT NULL)));

ALTER TABLE instruments ADD CONSTRAINT instruments_check2 CHECK (((simulated_stock_symbol IS NULL) OR ((asset_class = 'Equity'::text) AND (market = 'US'::text))));




ALTER TABLE instruments ADD CONSTRAINT instruments_market_check CHECK ((market = ANY (ARRAY['UK'::text, 'US'::text, 'IN'::text])));


ALTER TABLE instruments ADD CONSTRAINT instruments_pkey PRIMARY KEY (instrument_id);

ALTER TABLE instruments ADD CONSTRAINT instruments_simulated_stock_symbol_key UNIQUE (simulated_stock_symbol);

ALTER TABLE instruments ADD CONSTRAINT instruments_ticker_key UNIQUE (ticker);


ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_behavior_type_check CHECK ((behavior_type = ANY (ARRAY['normal'::text, 'uptrend'::text, 'downtrend'::text, 'sideways'::text, 'momentum'::text, 'mean_reversion'::text, 'breakout'::text, 'breakdown'::text, 'consolidation'::text, 'volatility_spike'::text])));



ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_duration_seconds_check CHECK ((duration_seconds > (0)::numeric));



ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_pkey PRIMARY KEY (id);



ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_strength_check CHECK (((strength >= ('-1'::integer)::numeric) AND (strength <= (1)::numeric)));




ALTER TABLE market_states ADD CONSTRAINT market_states_liquidity_check CHECK (((liquidity >= (0)::numeric) AND (liquidity <= (1)::numeric)));


ALTER TABLE market_states ADD CONSTRAINT market_states_momentum_check CHECK (((momentum >= ('-1'::integer)::numeric) AND (momentum <= (1)::numeric)));


ALTER TABLE market_states ADD CONSTRAINT market_states_pkey PRIMARY KEY (id);


ALTER TABLE market_states ADD CONSTRAINT market_states_session_symbol_unique UNIQUE (session_id, symbol);


ALTER TABLE market_states ADD CONSTRAINT market_states_trend_check CHECK ((trend = ANY (ARRAY['normal'::text, 'uptrend'::text, 'downtrend'::text, 'sideways'::text])));



ALTER TABLE market_states ADD CONSTRAINT market_states_volatility_check CHECK ((volatility >= (0)::numeric));


ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_ask_check CHECK ((ask > (0)::numeric));


ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_ask_size_check CHECK ((ask_size > 0));


ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_bid_check CHECK ((bid > (0)::numeric));

ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_bid_lower_than_ask CHECK ((bid < ask));


ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_bid_size_check CHECK ((bid_size > 0));



ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_pkey PRIMARY KEY (id);

ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_price_check CHECK ((price > (0)::numeric));


ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_price_within_spread CHECK (((price >= bid) AND (price <= ask)));

ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_sequence_number_check CHECK ((sequence_number > 0));



ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_session_sequence_unique UNIQUE (session_id, sequence_number);



ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_trade_volume_check CHECK ((trade_volume > 0));


ALTER TABLE orders ADD CONSTRAINT orders_account_id_client_reference_key UNIQUE (account_id, client_reference);





ALTER TABLE orders ADD CONSTRAINT orders_order_type_check CHECK ((order_type = ANY (ARRAY['BUY'::text, 'SELL'::text])));


ALTER TABLE orders ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);

ALTER TABLE orders ADD CONSTRAINT orders_quantity_check CHECK ((quantity > (0)::numeric));


ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'FILLED'::text, 'REJECTED'::text])));





ALTER TABLE portfolio_valuations ADD CONSTRAINT portfolio_valuations_pkey PRIMARY KEY (valuation_id);

ALTER TABLE portfolio_valuations ADD CONSTRAINT portfolio_valuations_portfolio_value_check CHECK ((portfolio_value >= (0)::numeric));



ALTER TABLE quotes ADD CONSTRAINT quotes_ask_check CHECK ((ask > (0)::numeric));


ALTER TABLE quotes ADD CONSTRAINT quotes_ask_size_check CHECK ((ask_size > 0));


ALTER TABLE quotes ADD CONSTRAINT quotes_bid_check CHECK ((bid > (0)::numeric));

ALTER TABLE quotes ADD CONSTRAINT quotes_bid_lower_than_ask CHECK ((bid < ask));


ALTER TABLE quotes ADD CONSTRAINT quotes_bid_size_check CHECK ((bid_size > 0));



ALTER TABLE quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


ALTER TABLE quotes ADD CONSTRAINT quotes_session_symbol_timestamp_unique UNIQUE (session_id, symbol, "timestamp");






ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);




ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_config_version_check CHECK ((config_version > 0));




ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_ended_after_started CHECK (((ended_at IS NULL) OR (ended_at >= started_at)));

ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_failure_fields CHECK (((status = 'FAILED'::text) OR ((failure_code IS NULL) AND (failure_detail IS NULL))));


ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_pkey PRIMARY KEY (id);



ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_status_check CHECK ((status = ANY (ARRAY['CREATED'::text, 'RUNNING'::text, 'PAUSED'::text, 'COMPLETED'::text, 'FAILED'::text, 'RESET'::text])));


ALTER TABLE simulation_sessions ADD CONSTRAINT simulation_sessions_terminal_end_time CHECK (((status <> ALL (ARRAY['COMPLETED'::text, 'FAILED'::text, 'RESET'::text])) OR (ended_at IS NOT NULL)));

ALTER TABLE stocks ADD CONSTRAINT stocks_average_volume_check CHECK ((average_volume > 0));


ALTER TABLE stocks ADD CONSTRAINT stocks_base_volatility_check CHECK ((base_volatility >= (0)::numeric));




ALTER TABLE stocks ADD CONSTRAINT stocks_pkey PRIMARY KEY (symbol);


ALTER TABLE stocks ADD CONSTRAINT stocks_starting_price_check CHECK ((starting_price > (0)::numeric));



ALTER TABLE stocks ADD CONSTRAINT stocks_symbol_uppercase CHECK (((symbol)::text = upper((symbol)::text)));

ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_account_status_check CHECK ((account_status = ANY (ARRAY['ACTIVE'::text, 'DEACTIVATED'::text])));






ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_pkey PRIMARY KEY (user_id);



ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_user_role_check CHECK ((user_role = ANY (ARRAY['ADMIN'::text, 'TRADER'::text])));



ALTER TABLE users ADD CONSTRAINT users_available_funds_check CHECK ((available_funds >= (0)::numeric));




ALTER TABLE users ADD CONSTRAINT users_execution_buffer_percent_check CHECK ((execution_buffer_percent >= (0)::numeric));




ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);



ALTER TABLE users ADD CONSTRAINT users_trader_level_check CHECK ((trader_level = ANY (ARRAY['BEGINNER'::text, 'INTERMEDIATE'::text, 'ADVANCED'::text])));



ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id);

ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(order_id);

ALTER TABLE candles ADD CONSTRAINT candles_session_id_fkey FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE;

ALTER TABLE candles ADD CONSTRAINT candles_symbol_fkey FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;

ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id);

ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_fill_id_fkey FOREIGN KEY (fill_id) REFERENCES fills(fill_id);

ALTER TABLE fills ADD CONSTRAINT fills_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(order_id);

ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id);

ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_fill_id_fkey FOREIGN KEY (fill_id) REFERENCES fills(fill_id);

ALTER TABLE holding_movements ADD CONSTRAINT holding_movements_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id);

ALTER TABLE holdings ADD CONSTRAINT holdings_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id);

ALTER TABLE holdings ADD CONSTRAINT holdings_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id);

ALTER TABLE instruments ADD CONSTRAINT instruments_simulated_stock_symbol_fkey FOREIGN KEY (simulated_stock_symbol) REFERENCES stocks(symbol);

ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_session_id_fkey FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE;

ALTER TABLE market_behaviors ADD CONSTRAINT market_behaviors_symbol_fkey FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;

ALTER TABLE market_states ADD CONSTRAINT market_states_session_id_fkey FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE;

ALTER TABLE market_states ADD CONSTRAINT market_states_symbol_fkey FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;

ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_session_id_fkey FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE;

ALTER TABLE market_ticks ADD CONSTRAINT market_ticks_symbol_fkey FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;

ALTER TABLE orders ADD CONSTRAINT orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id);

ALTER TABLE orders ADD CONSTRAINT orders_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(instrument_id);

ALTER TABLE portfolio_valuations ADD CONSTRAINT portfolio_valuations_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;

ALTER TABLE quotes ADD CONSTRAINT quotes_session_id_fkey FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE;

ALTER TABLE quotes ADD CONSTRAINT quotes_symbol_fkey FOREIGN KEY (symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;

ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE;

ALTER TABLE users ADD CONSTRAINT users_account_fkey FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) NOT VALID;

CREATE INDEX idx_market_ticks_session_symbol_timestamp ON public.market_ticks USING btree (session_id, symbol, "timestamp");

CREATE INDEX idx_market_behaviors_session_symbol_start_time ON public.market_behaviors USING btree (session_id, symbol, start_time);

CREATE INDEX idx_simulation_sessions_created_id ON public.simulation_sessions USING btree (created_at DESC, id DESC);

CREATE INDEX idx_simulation_sessions_active_status ON public.simulation_sessions USING btree (status) WHERE (status = ANY (ARRAY['CREATED'::text, 'RUNNING'::text, 'PAUSED'::text]));

CREATE INDEX idx_market_ticks_session_symbol_sequence ON public.market_ticks USING btree (session_id, symbol, sequence_number);

CREATE UNIQUE INDEX user_accounts_email_lower_key ON public.user_accounts USING btree (lower(email));

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);

CREATE INDEX portfolio_valuations_account_time ON public.portfolio_valuations USING btree (account_id, observed_at, valuation_id);

ALTER SEQUENCE audit_trail_audit_id_seq OWNED BY audit_trail.audit_id;

ALTER SEQUENCE simulation_sessions_id_seq OWNED BY simulation_sessions.id;

ALTER SEQUENCE instruments_instrument_id_seq OWNED BY instruments.instrument_id;

ALTER SEQUENCE accounts_account_id_seq OWNED BY accounts.account_id;

ALTER SEQUENCE market_states_id_seq OWNED BY market_states.id;

ALTER SEQUENCE market_behaviors_id_seq OWNED BY market_behaviors.id;

ALTER SEQUENCE quotes_id_seq OWNED BY quotes.id;

ALTER SEQUENCE market_ticks_id_seq OWNED BY market_ticks.id;

ALTER SEQUENCE candles_id_seq OWNED BY candles.id;

ALTER SEQUENCE holdings_holding_id_seq OWNED BY holdings.holding_id;

ALTER SEQUENCE orders_order_id_seq OWNED BY orders.order_id;

ALTER SEQUENCE fills_fill_id_seq OWNED BY fills.fill_id;

ALTER SEQUENCE cash_transactions_cash_transaction_id_seq OWNED BY cash_transactions.cash_transaction_id;

ALTER SEQUENCE holding_movements_holding_movement_id_seq OWNED BY holding_movements.holding_movement_id;

ALTER SEQUENCE portfolio_valuations_valuation_id_seq OWNED BY portfolio_valuations.valuation_id;

COMMIT;
