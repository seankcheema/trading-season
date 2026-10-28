import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.baselines import fit_logistic
from stock_forecast.horizons import future_volatility, horizon_dataset, horizon_rows
from stock_forecast.vix_family import vix_family_dataset
from tests.helpers import FakeLstm, snapshot_patches


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



class HorizonRowsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.patches = snapshot_patches(Path(cls.folder.name))
        for patch in cls.patches:
            patch.start()

    @classmethod
    def tearDownClass(cls):
        for patch in cls.patches:
            patch.stop()
        cls.folder.cleanup()

    def test_label_is_the_window_volatility_and_days_without_a_full_window_are_dropped(self):
        data, full = horizon_dataset("SPY", 3), vix_family_dataset("SPY")
        self.assertEqual(data.index[-1], full.index[-4])
        np.testing.assert_allclose(data["target"], future_volatility(full["ret"], 3).loc[data.index])

    def test_rows_cover_every_walk_forward_year_and_never_the_test_years(self):
        table = pd.DataFrame(horizon_rows("SPY", 3, with_lstm=False))
        self.assertEqual(list(table["split"]), [f"walk-forward {y}" for y in config.WALK_FORWARD_YEARS])
        self.assertEqual(set(table["model"]), {"Logistic regression"})
        self.assertEqual(set(table["horizon_days"]), {3})
        self.assertEqual(set(table["training_window"]), {"all history"})

    def test_a_sliding_window_fits_on_fewer_rows_than_all_history(self):
        sizes = {}
        for years in (None, 1):
            with mock.patch("stock_forecast.horizons.fit_logistic", wraps=fit_logistic) as fit:
                rows = horizon_rows("SPY", 3, with_lstm=False, train_years=years)
            sizes[years] = [len(call.args[1]) for call in fit.call_args_list]
            self.assertEqual(rows[0]["training_window"], "all history" if years is None else "last 1 years")
        self.assertTrue(all(short < full for short, full in zip(sizes[1], sizes[None])))

    def test_lstm_rows_purge_the_window_and_are_averaged_with_the_regression(self):
        with FakeLstm() as fake:
            table = pd.DataFrame(horizon_rows("AAPL", 3))
        self.assertEqual(set(table["model"]), {"Logistic regression", "LSTM", "Average of both"})
        self.assertEqual(len(fake.fits), len(config.WALK_FORWARD_YEARS))
        self.assertEqual(len(table), 3 * len(config.WALK_FORWARD_YEARS))


if __name__ == "__main__":
    unittest.main()
