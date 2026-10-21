import unittest

import numpy as np

from stock_forecast.data import split_by_date
from stock_forecast.windows import aligned_rows, fit_scalers, lag_matrix, make_windows
from tests.helpers import make_dataset

LOOKBACK = 30


class WindowTests(unittest.TestCase):
    # Window tests also check that each label follows its input day without leakage.
    def setUp(self):
        self.splits = split_by_date(make_dataset())
        self.scalers = fit_scalers(self.splits.train)

    def test_shapes_without_history(self):
        X, y = make_windows(self.splits.train, self.scalers, LOOKBACK)
        self.assertEqual(X.shape, (len(self.splits.train) - LOOKBACK + 1, LOOKBACK, 1))
        self.assertEqual(y.shape, (X.shape[0],))

    def test_history_gives_every_row_a_window(self):
        X, y = make_windows(self.splits.val, self.scalers, LOOKBACK, history=self.splits.train)
        self.assertEqual(X.shape, (len(self.splits.val), LOOKBACK, 1))
        self.assertEqual(len(y), len(self.splits.val))

    def test_window_ends_today_and_label_is_tomorrow(self):
        X, y = make_windows(self.splits.val, self.scalers, LOOKBACK, history=self.splits.train)
        day = self.splits.val.iloc[7]
        today = self.scalers.features.transform([[day["ret"]]])[0, 0]
        label = self.scalers.target.transform([[day["target"]]])[0, 0]
        self.assertAlmostEqual(X[7, -1, 0], today)
        self.assertAlmostEqual(y[7], label)

    def test_first_window_starts_in_the_history(self):
        X, _ = make_windows(self.splits.val, self.scalers, LOOKBACK, history=self.splits.train)
        oldest = self.scalers.features.transform([[self.splits.train["ret"].iloc[-(LOOKBACK - 1)]]])[0, 0]
        self.assertAlmostEqual(X[0, 0, 0], oldest)

    def test_scalers_are_fit_on_training_rows_only(self):
        self.assertAlmostEqual(self.scalers.features.mean_[0], self.splits.train["ret"].mean())
        self.assertAlmostEqual(self.scalers.target.mean_[0], self.splits.train["target"].mean())

    def test_changing_the_future_does_not_change_past_windows(self):
        # Mutating later rows must leave earlier inputs unchanged.
        val = self.splits.val.copy()
        X_before, _ = make_windows(val, self.scalers, LOOKBACK, history=self.splits.train)
        val.iloc[100:, val.columns.get_loc("ret")] = 0.5
        X_after, _ = make_windows(val, self.scalers, LOOKBACK, history=self.splits.train)
        np.testing.assert_allclose(X_before[:100], X_after[:100])

    def test_several_features(self):
        scalers = fit_scalers(self.splits.train, ("ret", "spy_ret", "volume_change"))
        X, _ = make_windows(self.splits.val, scalers, LOOKBACK, history=self.splits.train)
        self.assertEqual(X.shape, (len(self.splits.val), LOOKBACK, 3))

    def test_too_few_rows_is_an_error(self):
        with self.assertRaises(ValueError):
            make_windows(self.splits.val.iloc[:10], self.scalers, LOOKBACK)

    def test_aligned_rows_match_window_count(self):
        self.assertEqual(len(aligned_rows(self.splits.train, LOOKBACK)), len(self.splits.train) - LOOKBACK + 1)
        self.assertEqual(len(aligned_rows(self.splits.val, LOOKBACK, self.splits.train)), len(self.splits.val))


class LagMatrixTests(unittest.TestCase):
    # Classical models use flat lags, with index 0 holding the newest return.
    def test_newest_return_comes_first_and_is_unscaled(self):
        splits = split_by_date(make_dataset())
        lags = lag_matrix(splits.val, LOOKBACK, history=splits.train)
        self.assertEqual(lags.shape, (len(splits.val), LOOKBACK))
        self.assertAlmostEqual(lags[5, 0], splits.val["ret"].iloc[5])
        self.assertAlmostEqual(lags[5, 1], splits.val["ret"].iloc[4])
        self.assertAlmostEqual(lags[0, 1], splits.train["ret"].iloc[-1])


if __name__ == "__main__":
    unittest.main()
