import unittest

import numpy as np

from stock_forecast.data import add_indicators, split_by_date
from tests.helpers import make_dataset


class IndicatorTests(unittest.TestCase):
    # Indicators must only look back: day t uses data known at day t's close.
    def setUp(self):
        self.dataset = make_dataset()
        self.indicators = add_indicators(self.dataset)

    def test_adds_the_columns_and_drops_only_warm_up_rows(self):
        self.assertIn("volatility_10", self.indicators)
        self.assertIn("momentum_20", self.indicators)
        self.assertFalse(self.indicators.isna().any().any())
        self.assertEqual(len(self.indicators), len(self.dataset) - 20)
        self.assertEqual(self.indicators.index[-1], self.dataset.index[-1])

    def test_values_use_only_past_rows(self):
        day = self.indicators.index[100]
        position = self.dataset.index.get_loc(day)
        past_returns = self.dataset["ret"].iloc[position - 9 : position + 1]
        self.assertAlmostEqual(self.indicators.loc[day, "volatility_10"], past_returns.std())
        close = self.dataset["close"]
        self.assertAlmostEqual(self.indicators.loc[day, "momentum_20"],
                               close.iloc[position] / close.iloc[position - 20] - 1)

    def test_changing_the_future_does_not_change_past_indicators(self):
        changed = self.dataset.copy()
        changed.iloc[500:, changed.columns.get_loc("ret")] = 0.5
        changed.iloc[500:, changed.columns.get_loc("close")] *= 3
        before, after = self.indicators.iloc[:400], add_indicators(changed).iloc[:400]
        np.testing.assert_allclose(before[["volatility_10", "momentum_20"]], after[["volatility_10", "momentum_20"]])

    def test_split_still_works_on_the_indicator_dataset(self):
        splits = split_by_date(self.indicators)
        self.assertEqual(len(splits.val) + len(splits.test),
                         len(split_by_date(self.dataset).val) + len(split_by_date(self.dataset).test))


if __name__ == "__main__":
    unittest.main()
