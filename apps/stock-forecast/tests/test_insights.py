import tempfile
import unittest

import numpy as np

from stock_forecast.data import add_indicators, split_by_date
from stock_forecast.evaluate import plot_market_conditions
from stock_forecast.insights import condition_rules, market_conditions
from tests.helpers import make_dataset


class MarketConditionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(add_indicators(make_dataset()))
        cls.table = market_conditions(cls.splits.train, {"train": cls.splits.train, "validation": cls.splits.val})

    def test_one_row_per_rule_with_days_and_rates(self):
        self.assertEqual(len(self.table), len(condition_rules(self.splits.train)))
        self.assertEqual(list(self.table.columns),
                         ["condition", "train_days", "train_up_rate", "validation_days", "validation_up_rate"])

    def test_every_day_row_is_the_plain_up_rate(self):
        row = self.table.set_index("condition").loc["Every day"]
        self.assertEqual(row["validation_days"], len(self.splits.val))
        self.assertAlmostEqual(row["validation_up_rate"], (self.splits.val["target"] > 0).mean())

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

    def test_chart_is_written(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(plot_market_conditions(self.table, f"{folder}/m.png", "t").exists())


if __name__ == "__main__":
    unittest.main()
