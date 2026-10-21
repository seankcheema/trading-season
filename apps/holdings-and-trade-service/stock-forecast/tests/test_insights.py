import tempfile
import unittest

import numpy as np

from stock_forecast.data import add_indicators, split_by_date
from stock_forecast.evaluate import plot_market_conditions
from stock_forecast.insights import condition_rules, market_conditions, return_autocorrelation
from tests.helpers import make_dataset, simulate_var


class MarketConditionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(add_indicators(make_dataset()))
        cls.table = market_conditions(cls.splits.train, {"train": cls.splits.train, "validation": cls.splits.val})

    def test_one_row_per_rule_with_days_and_rates(self):
        self.assertEqual(len(self.table), len(condition_rules(self.splits.train)))
        self.assertEqual(list(self.table.columns),
                         ["condition", "train_days", "train_up_rate", "train_mean_return",
                          "validation_days", "validation_up_rate", "validation_mean_return"])

    def test_every_day_row_is_the_plain_up_rate(self):
        row = self.table.set_index("condition").loc["Every day"]
        self.assertEqual(row["validation_days"], len(self.splits.val))
        self.assertAlmostEqual(row["validation_up_rate"], (self.splits.val["target"] > 0).mean())
        self.assertAlmostEqual(row["validation_mean_return"], self.splits.val["target"].mean())

    def test_thresholds_come_from_training_only(self):
        changed_val = self.splits.val.copy()
        changed_val["volatility_10"] *= 100  # would move a quantile cut-off if validation were used
        table = market_conditions(self.splits.train, {"validation": changed_val})
        high = table.set_index("condition").loc["High volatility (top 20% in training)", "validation_days"]
        self.assertEqual(high, len(changed_val))

    def test_condition_with_no_matching_days_is_nan(self):
        calm = self.splits.val.copy()
        calm["ret"] = 0.0
        table = market_conditions(self.splits.train, {"calm": calm}).set_index("condition")
        self.assertTrue(np.isnan(table.loc["After a drop of 2% or more", "calm_up_rate"]))

    def test_autocorrelation_finds_reversal_and_ignores_a_random_walk(self):
        # a(t) = -0.3 a(t-1) + noise: a known mean-reverting series.
        reverting = simulate_var([[[-0.3, 0.0], [0.0, 0.0]]], [0.0, 0.0], 3000, seed=1).rename(columns={"a": "ret"})
        table = return_autocorrelation({"reverting": reverting, "random walk": self.splits.train}, lags=range(1, 3))
        first = table[(table["period"] == "reverting") & (table["lag_days"] == 1)].iloc[0]
        self.assertAlmostEqual(first["autocorrelation"], -0.3, delta=0.05)
        self.assertTrue(first["beyond_noise"])
        walk = table[(table["period"] == "random walk") & (table["lag_days"] == 1)].iloc[0]
        self.assertLess(abs(walk["autocorrelation"]), 3 * walk["standard_error"])
        self.assertEqual(walk["days"], len(self.splits.train) - 1)

    def test_chart_is_written(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(plot_market_conditions(self.table, f"{folder}/m.png", "t").exists())


if __name__ == "__main__":
    unittest.main()
