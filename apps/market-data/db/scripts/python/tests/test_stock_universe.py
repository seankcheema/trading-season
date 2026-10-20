"""The simulated universe is US equities only (BR-12 as clarified on 20 October 2026).

Pure checks on lib.common.STOCKS against the rules V001 enforces on the
stocks and instruments tables, including the check that only a US equity
may link to a simulated price series. No database is needed.
"""
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import STOCKS  # noqa: E402

STOCK_SYMBOL = re.compile(r"^[A-Z0-9]{1,5}$")


class StockUniverseTest(unittest.TestCase):
    def test_every_series_is_a_us_equity_in_dollars(self):
        self.assertEqual(10, len(STOCKS))
        for stock in STOCKS:
            with self.subTest(symbol=stock.symbol):
                self.assertEqual("Equity", stock.asset_class)
                self.assertEqual("US", stock.market)
                self.assertEqual("USD", stock.currency)
                self.assertEqual(stock.symbol, stock.instrument_ticker)

    def test_symbols_fit_the_schema(self):
        self.assertEqual(len(STOCKS), len({s.symbol for s in STOCKS}))
        for stock in STOCKS:
            self.assertRegex(stock.symbol, STOCK_SYMBOL)
            self.assertGreater(stock.starting_price, 0)
            self.assertGreater(stock.average_volume, 0)
            self.assertGreaterEqual(stock.base_volatility, 0)


if __name__ == "__main__":
    unittest.main()
