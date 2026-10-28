import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.data import add_indicators, add_vix, split_by_date
from stock_forecast.pooled import pooled_vix_rows, pooled_volatility_predictions
from tests.helpers import FakeLstm, make_dataset, make_prices, snapshot_patches

HAS_TENSORFLOW = importlib.util.find_spec("tensorflow") is not None


class VixTests(unittest.TestCase):
    def test_vix_inputs_are_known_at_the_close_and_join_by_date(self):
        dataset = make_dataset()
        vix = make_prices(5, start_price=20.0)
        joined = add_vix(dataset, vix.iloc[::-1])  # row order must not matter
        day = joined.index[50]
        self.assertAlmostEqual(joined.loc[day, "vix"], vix.loc[day, "Close"] / 100)
        previous = vix.index[vix.index.get_loc(day) - 1]
        self.assertAlmostEqual(joined.loc[day, "vix_change"], np.log(vix.loc[day, "Close"] / vix.loc[previous, "Close"]))
        self.assertFalse(joined.isna().any().any())

    def test_days_without_vix_are_dropped_not_filled(self):
        dataset = make_dataset()
        vix = make_prices(5, start_price=20.0).drop(dataset.index[100])
        joined = add_vix(dataset, vix)
        self.assertNotIn(dataset.index[100], joined.index)

    def test_vix_features_extend_the_volatility_features(self):
        self.assertEqual(config.VIX_FEATURES[: len(config.VOLATILITY_FEATURES)], config.VOLATILITY_FEATURES)
        self.assertEqual(config.VIX_FEATURES[-2:], ["vix", "vix_change"])


class LabelChoiceTests(unittest.TestCase):
    def test_labels_come_from_the_threshold_or_from_the_rows_own_column(self):
        from stock_forecast.pooled import _labels

        part = add_indicators(make_dataset(0)).iloc[:30].copy()
        part["big"] = np.arange(len(part)) % 2 == 0
        threshold = float(part["target"].abs().median())
        np.testing.assert_array_equal(_labels(part, 10, None, threshold, None),
                                      (part["target"].abs().to_numpy()[9:] > threshold).astype(float))
        np.testing.assert_array_equal(_labels(part, 10, None, threshold, "big"), part["big"].to_numpy()[9:].astype(float))
        # With history every row gets a window, so every row's label is used.
        np.testing.assert_array_equal(_labels(part, 10, part, threshold, "big"), part["big"].to_numpy().astype(float))


def pooled_periods(shift: float = 0.0) -> dict:
    """Two stocks' train, validation, scored part and history; `shift` moves S2's inputs by a constant."""
    periods = {}
    for seed in (0, 2):
        data = add_vix(add_indicators(make_dataset(seed)), make_prices(9, start_price=20.0))
        if seed == 2:
            data[["abs_ret", "vix"]] += shift
        splits = split_by_date(data)
        train = splits.train.iloc[-300:]
        periods[f"S{seed}"] = (train, splits.val.iloc[:80], splits.val, train)
    return periods


class PooledOrchestrationTests(unittest.TestCase):
    """The pooling around the LSTM, with a stand-in model, so it runs without TensorFlow."""

    def test_the_last_purge_labels_of_every_stock_are_never_fitted(self):
        periods = pooled_periods()
        with FakeLstm() as fake:
            probs = pooled_volatility_predictions(periods, ("abs_ret", "vix"), lookback=10, units=4, purge=3)
        fit = fake.fits[0]
        self.assertEqual(len(fit["y_train"]), sum(len(train) - 3 - 10 + 1 for train, *_ in periods.values()))
        self.assertEqual(len(fit["y_val"]), sum(len(val) - 3 for _, val, *_ in periods.values()))
        for symbol, (_, _, part, _) in periods.items():
            self.assertEqual(probs[symbol].shape, (len(part),))

    def test_each_stock_is_scaled_on_its_own_training_rows(self):
        with FakeLstm() as fake:
            before = pooled_volatility_predictions(pooled_periods(), ("abs_ret", "vix"), lookback=10, units=4)
            after = pooled_volatility_predictions(pooled_periods(shift=5.0), ("abs_ret", "vix"), lookback=10, units=4)
        np.testing.assert_allclose(fake.fits[0]["X_train"], fake.fits[1]["X_train"])
        np.testing.assert_allclose(before["S2"], after["S2"])

    def test_purge_below_one_is_rejected(self):
        with FakeLstm(), self.assertRaises(ValueError):
            pooled_volatility_predictions(pooled_periods(), ("abs_ret",), lookback=10, units=4, purge=0)


class PooledVixRowsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        patches = snapshot_patches(Path(cls.folder.name))
        for patch in patches:
            patch.start()
        try:
            with FakeLstm():
                cls.table = pd.DataFrame(pooled_vix_rows(["AAPL", "SPY"]))
        finally:
            for patch in patches:
                patch.stop()
            cls.folder.cleanup()

    def test_every_model_is_scored_on_validation_and_each_walk_forward_year(self):
        splits = {"validation", *(f"walk-forward {y}" for y in config.WALK_FORWARD_YEARS)}
        models = {"Logistic regression", "Logistic regression + VIX", "LSTM, one stock", "LSTM, one stock + VIX",
                  "LSTM, all stocks", "LSTM, all stocks + VIX"}
        for symbol in ("AAPL", "SPY"):
            rows = self.table[self.table["symbol"] == symbol]
            self.assertEqual(set(rows["split"]), splits)
            self.assertEqual(set(rows["model"]), models)
        self.assertEqual(len(self.table), 2 * len(splits) * len(models))


@unittest.skipUnless(HAS_TENSORFLOW, "TensorFlow is not installed")
class PooledModelTests(unittest.TestCase):
    def test_one_model_scores_every_stock_on_its_own_days(self):
        from stock_forecast.pooled import pooled_volatility_predictions

        periods = {}
        for seed in (0, 2):
            splits = split_by_date(add_vix(add_indicators(make_dataset(seed)), make_prices(9, start_price=20.0)))
            train = splits.train.iloc[-300:]
            periods[f"S{seed}"] = (train, splits.val.iloc[:80], splits.val, train)
        probs = pooled_volatility_predictions(periods, ("abs_ret", "vix"), lookback=10, units=4)
        self.assertEqual(set(probs), {"S0", "S2"})
        for symbol, (_, _, part, _) in periods.items():
            self.assertEqual(probs[symbol].shape, (len(part),))
            self.assertTrue(((probs[symbol] > 0) & (probs[symbol] < 1)).all())


if __name__ == "__main__":
    unittest.main()
