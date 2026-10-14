"""The simulated universe covers every instrument class the BRS names (BR-12).

Pure checks on lib.common.STOCKS against the rules V001 enforces on the
stocks and instruments tables. No database is needed.
"""
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import STOCKS  # noqa: E402

EQUITY_TICKER = re.compile(r"^[A-Z][A-Z0-9.]{0,4}$")
STOCK_SYMBOL = re.compile(r"^[A-Z0-9]{1,5}$")


class StockUniverseTest(unittest.TestCase):
    def test_every_required_class_and_market_is_simulated(self):
        classes = {(s.asset_class, s.market) for s in STOCKS}
        for required in (("Equity", "UK"), ("Equity", "US"), ("Equity", "IN"), ("FX", None), ("Crypto", None)):
            self.assertIn(required, classes)

    def test_symbols_and_tickers_fit_the_schema(self):
        self.assertEqual(len(STOCKS), len({s.symbol for s in STOCKS}))
        self.assertEqual(len(STOCKS), len({s.instrument_ticker for s in STOCKS}))
        for stock in STOCKS:
            self.assertRegex(stock.symbol, STOCK_SYMBOL)
            self.assertIn(stock.asset_class, ("Equity", "FX", "Crypto"))
            self.assertEqual(stock.asset_class == "Equity", stock.market is not None)
            if stock.market is not None:
                self.assertIn(stock.market, ("UK", "US", "IN"))
            if stock.asset_class == "Equity":
                self.assertRegex(stock.instrument_ticker, EQUITY_TICKER)
                self.assertEqual(stock.symbol, stock.instrument_ticker)
            self.assertEqual("USD", stock.currency)
            self.assertGreater(stock.starting_price, 0)
            self.assertGreater(stock.average_volume, 0)
            self.assertGreaterEqual(stock.base_volatility, 0)


if __name__ == "__main__":
    unittest.main()
