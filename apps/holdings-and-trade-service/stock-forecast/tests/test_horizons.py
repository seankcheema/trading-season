import unittest

import numpy as np
import pandas as pd

from stock_forecast.horizons import future_volatility


class FutureVolatilityTests(unittest.TestCase):
    def test_one_day_is_the_next_day_move_size(self):
        r = pd.Series([0.01, -0.02, 0.03, 0.0, 0.01])
        np.testing.assert_allclose(future_volatility(r, 1).iloc[:-1], [0.02, 0.03, 0.0, 0.01])
        self.assertTrue(np.isnan(future_volatility(r, 1).iloc[-1]))

    def test_window_is_the_root_mean_square_of_the_next_days(self):
        r = pd.Series([0.01, -0.02, 0.03, 0.0, 0.01])
        out = future_volatility(r, 2)
        self.assertAlmostEqual(out.iloc[0], np.sqrt((0.02 ** 2 + 0.03 ** 2) / 2))
        self.assertTrue(out.iloc[-2:].isna().all())  # no complete window at the end

    def test_today_never_enters_its_own_label(self):
        r = pd.Series([0.5, 0.0, 0.0, 0.0])
        self.assertEqual(future_volatility(r, 2).iloc[0], 0.0)

    def test_bad_window_is_rejected(self):
        with self.assertRaises(ValueError):
            future_volatility(pd.Series([0.01]), 0)


class PurgeTests(unittest.TestCase):
    def test_purge_below_one_is_rejected_before_training(self):
        from stock_forecast.pipeline import event_lstm_predictions
        from tests.helpers import make_dataset

        data = make_dataset()
        with self.assertRaises(ValueError):
            event_lstm_predictions(data.iloc[:300], data.iloc[300:400], data.iloc[400:450], data.iloc[300:400],
                                   ("ret",), lookback=10, units=2, big_move=0.01, purge=0)


if __name__ == "__main__":
    unittest.main()
