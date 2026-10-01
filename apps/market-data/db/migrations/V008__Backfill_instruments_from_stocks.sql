-- Give every simulated stock a tradable instrument, so orders can name one.
--
-- Orders, holdings and fills all reference instruments.instrument_id, but nothing
-- populated that table: V001 creates it empty and the market data tooling only ever
-- loaded stocks. A database could therefore serve prices for symbols that no order
-- could be placed against.
--
-- This backfills an existing database from the stocks already in it. On a fresh
-- database it matches no rows, because migrations run before any market data is
-- imported; the import writes the same rows itself (see
-- apps/market-data/db/scripts/lib/importing.py). Both paths are idempotent and agree
-- on the result, so it does not matter which one runs first or how often.
--
-- simulated_stock_symbol is the link a client uses to map a quote back to an
-- instrument. The schema permits it only for US equities, which is what every seeded
-- stock is.

INSERT INTO instruments (ticker, name, asset_class, market, currency, is_tradable, simulated_stock_symbol)
SELECT symbol, company_name, 'Equity', 'US', 'USD', TRUE, symbol
FROM stocks
ON CONFLICT (ticker) DO UPDATE
SET name = excluded.name,
    asset_class = excluded.asset_class,
    market = excluded.market,
    currency = excluded.currency,
    simulated_stock_symbol = excluded.simulated_stock_symbol;
