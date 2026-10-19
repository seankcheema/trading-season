import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.data import save_prices
from stock_forecast.evaluate import plot_symbol_comparison
from stock_forecast.symbols import MARKET_COLUMNS, inputs_for, load_symbol_dataset, summarise, symbol_rows
from tests.helpers import make_prices


class SymbolConfigTests(unittest.TestCase):
    def test_every_comparison_symbol_has_one_snapshot_path(self):
        self.assertEqual(config.COMPARISON_SYMBOLS[:2], [config.TICKER, config.MARKET_TICKER])
        self.assertEqual(set(config.COMPARISON_SYMBOLS), set(config.SYMBOL_CSVS))
        for symbol in config.EXTRA_SYMBOLS:
            self.assertEqual(config.SYMBOL_CSVS[symbol], config.DATA_DIR / f"{symbol.lower()}_daily.csv")
        # The extra snapshots never replace the AAPL and SPY files.
        self.assertEqual(config.SYMBOL_CSVS[config.TICKER], config.PRICES_CSV)
        self.assertEqual(config.SYMBOL_CSVS[config.MARKET_TICKER], config.MARKET_CSV)
        self.assertEqual(len(set(config.SYMBOL_CSVS.values())), len(config.SYMBOL_CSVS))


class SymbolComparisonTests(unittest.TestCase):
    # Point the comparison at two synthetic snapshots, so no real data is needed.
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        stock, market = Path(cls.folder.name) / "stock.csv", Path(cls.folder.name) / "market.csv"
        save_prices(make_prices(0), stock)
        save_prices(make_prices(1, start_price=300.0), market)
        cls.patches = [mock.patch.object(config, "SYMBOL_CSVS", {"AAPL": stock, "SPY": market}),
                       mock.patch.object(config, "MARKET_CSV", market)]
        for patch in cls.patches:
            patch.start()

    @classmethod
    def tearDownClass(cls):
        for patch in cls.patches:
            patch.stop()
        cls.folder.cleanup()

    def test_market_inputs_are_dropped_only_for_the_market_itself(self):
        self.assertEqual(inputs_for("AAPL", config.VOLATILITY_FEATURES), tuple(config.VOLATILITY_FEATURES))
        spy = inputs_for("SPY", config.VOLATILITY_FEATURES)
        self.assertFalse(set(spy) & set(MARKET_COLUMNS))
        self.assertIn("abs_ret", spy)

    def test_the_market_as_target_has_its_own_returns_as_market_column(self):
        dataset = load_symbol_dataset("SPY")
        np.testing.assert_allclose(dataset["ret"], dataset["spy_ret"])

    def test_unknown_symbol_is_an_error(self):
        with self.assertRaises(ValueError):
            load_symbol_dataset("MSFT")

    def test_rows_cover_both_tasks_validation_and_every_walk_forward_year(self):
        table = pd.DataFrame(symbol_rows("SPY", with_lstm=False))
        self.assertEqual(set(table["task"]), {"direction", "volatility"})
        splits = set(table["split"])
        self.assertIn("validation", splits)
        self.assertEqual({s for s in splits if s.startswith("walk-forward")},
                         {f"walk-forward {y}" for y in config.WALK_FORWARD_YEARS})
        self.assertFalse(table["split"].str.contains("test").any())

    def test_no_model_beats_a_coin_flip_on_a_random_walk(self):
        """Leak alarm, as for AAPL: random-walk prices have nothing to learn."""
        table = pd.DataFrame(symbol_rows("SPY", with_lstm=False))
        self.assertTrue((table["accuracy"] < 0.6).all(), table[table["accuracy"] >= 0.6])

    def test_summary_counts_years_beating_the_bar(self):
        table = pd.DataFrame([
            {"symbol": "X", "task": "volatility", "model": "M", "split": "validation", "accuracy": 0.6, "bar_to_clear": 0.5, "brier_skill": 0.1},
            {"symbol": "X", "task": "volatility", "model": "M", "split": "walk-forward 2018", "accuracy": 0.6, "bar_to_clear": 0.5, "brier_skill": 0.1},
            {"symbol": "X", "task": "volatility", "model": "M", "split": "walk-forward 2019", "accuracy": 0.4, "bar_to_clear": 0.5, "brier_skill": -0.1},
        ])
        row = summarise(table).iloc[0]
        self.assertEqual(row["years_beating_bar"], 1)
        self.assertAlmostEqual(row["accuracy"], 0.5)
        self.assertAlmostEqual(row["validation_accuracy"], 0.6)

    def test_comparison_chart_is_written(self):
        summary = summarise(pd.DataFrame(symbol_rows("SPY", with_lstm=False)))
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(plot_symbol_comparison(summary, Path(folder) / "c.png", "t").exists())


if __name__ == "__main__":
    unittest.main()
