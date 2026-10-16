"""Volatility (big-move) model tests: threshold, labels, metrics, baselines and the LSTM."""
import importlib.util
import tempfile
import unittest

import numpy as np

from stock_forecast.data import add_indicators, add_range_features, split_by_date
from stock_forecast.evaluate import direction_metrics, event_confidence_buckets, event_metrics, plot_event_probability
from stock_forecast.pipeline import (big_move_days, big_move_threshold, volatility_baselines, volatility_fold,
                                     volatility_row)
from stock_forecast.walk_forward import walk_forward_folds
from stock_forecast.windows import event_labels, fit_scalers, make_windows
from tests.helpers import make_dataset

HAS_TENSORFLOW = importlib.util.find_spec("tensorflow") is not None


class BigMoveDefinitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(add_indicators(make_dataset()))
        cls.threshold = big_move_threshold(cls.splits.train)

    def test_threshold_is_the_training_median_without_the_boundary_label(self):
        expected = self.splits.train["target"].iloc[:-1].abs().median()
        self.assertAlmostEqual(self.threshold, expected)
        self.assertAlmostEqual(big_move_days(self.splits.train.iloc[:-1], self.threshold).mean(), 0.5, delta=0.01)

    def test_big_moves_count_both_directions(self):
        part = self.splits.val.iloc[:4].copy()
        part["target"] = [self.threshold * 2, -self.threshold * 2, self.threshold / 2, -self.threshold / 2]
        np.testing.assert_array_equal(big_move_days(part, self.threshold), [True, True, False, False])

    def test_labels_align_with_windows(self):
        scalers = fit_scalers(self.splits.train)
        X, _ = make_windows(self.splits.val, scalers, 10, history=self.splits.train)
        labels = event_labels(self.splits.val, 10, history=self.splits.train, big_move=self.threshold)
        self.assertEqual(len(labels), len(X))
        np.testing.assert_array_equal(labels, big_move_days(self.splits.val, self.threshold).astype(float))

    def test_abs_return_columns_are_todays_move_size(self):
        np.testing.assert_allclose(self.splits.val["abs_ret"], self.splits.val["ret"].abs())
        np.testing.assert_allclose(self.splits.val["spy_abs_ret"], self.splits.val["spy_ret"].abs())


class RangeFeatureTests(unittest.TestCase):
    def test_range_inputs_look_back_and_align_by_date(self):
        from tests.helpers import make_prices

        dataset = add_indicators(make_dataset())
        prices = make_prices()
        extended = add_range_features(dataset, prices.iloc[::-1])  # reversed rows must still align by date
        day = extended.index[100]
        self.assertAlmostEqual(extended.loc[day, "range"],
                               (prices.loc[day, "High"] - prices.loc[day, "Low"]) / prices.loc[day, "Close"])
        position = dataset.index.get_loc(day)
        self.assertAlmostEqual(extended.loc[day, "volatility_60"], dataset["ret"].iloc[position - 59 : position + 1].std())
        self.assertFalse(extended.isna().any().any())
        self.assertEqual(extended.index[-1], dataset.index[-1])


class EventMetricTests(unittest.TestCase):
    def test_direction_metrics_are_event_metrics_on_up_days(self):
        actual = np.array([0.01, -0.01, 0.02, -0.03, 0.0])
        prob = np.array([0.7, 0.4, 0.6, 0.55, 0.3])
        generic = event_metrics(actual > 0, prob, base_rate=0.5)
        named = direction_metrics(actual, prob, base_rate=0.5)
        self.assertEqual(named["direction_accuracy"], generic["accuracy"])
        self.assertEqual(named["up_call_rate"], generic["call_rate"])
        self.assertEqual(named["actual_up_rate"], generic["event_rate"])
        self.assertEqual(named["brier_skill"], generic["brier_skill"])

    def test_event_buckets_and_chart(self):
        actual = np.array([True, False] * 25)
        prob = np.linspace(0.2, 0.8, 50)
        table = event_confidence_buckets(actual, prob)
        self.assertEqual(table["days"].sum(), 50)
        self.assertIn("event_rate", table)
        with tempfile.TemporaryDirectory() as folder:
            dates = make_dataset().index[:50]
            path = plot_event_probability(dates, prob, actual, f"{folder}/v.png", "t", event="big-move day")
            self.assertTrue(path.exists())


class VolatilityBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(add_indicators(make_dataset()))
        cls.threshold = big_move_threshold(cls.splits.train)
        cls.probs = volatility_baselines(cls.splits.train, cls.splits.val, cls.threshold)

    def test_every_baseline_gives_a_probability_for_every_day(self):
        self.assertEqual(list(self.probs), ["Training big-move rate (constant)", "Same as today",
                                            "Logistic regression (recent volatility)",
                                            "Logistic regression (indicators)"])
        for name, prob in self.probs.items():
            self.assertEqual(prob.shape, (len(self.splits.val),), name)
            self.assertTrue(((prob >= 0) & (prob <= 1)).all(), name)

    def test_same_as_today_copies_todays_move_size(self):
        expected = (self.splits.val["abs_ret"] > self.threshold).astype(float).to_numpy()
        np.testing.assert_array_equal(self.probs["Same as today"], expected)

    def test_nothing_predicts_big_moves_on_constant_volatility(self):
        """Leak alarm: the test prices have constant volatility, so there is nothing to find."""
        actual = big_move_days(self.splits.val, self.threshold)
        for name, prob in self.probs.items():
            row = volatility_row(name, actual, prob, 0.5, "validation")
            self.assertLess(row["accuracy"], 0.6, name)

    def test_walk_forward_fold_without_lstm(self):
        fold = walk_forward_folds(add_indicators(make_dataset()), years=[2019])[0]
        rows = volatility_fold(fold)
        self.assertEqual(len(rows), 4)
        self.assertTrue(all(row["threshold"] == big_move_threshold(fold.train) for row in rows))


@unittest.skipUnless(HAS_TENSORFLOW, "TensorFlow is not installed")
class VolatilityLstmTests(unittest.TestCase):
    def test_trains_and_predicts_probabilities(self):
        from stock_forecast.pipeline import volatility_lstm_predictions

        splits = split_by_date(add_indicators(make_dataset()))
        train = splits.train.iloc[-500:]
        threshold = big_move_threshold(train)
        run = volatility_lstm_predictions(train, splits.val.iloc[:120], splits.val, history=train, threshold=threshold,
                                          feature_cols=("abs_ret", "volatility_10"), lookback=10, units=4)
        self.assertEqual(run.prob_up.shape, (len(splits.val),))
        self.assertTrue(((run.prob_up > 0) & (run.prob_up < 1)).all())
        actual = big_move_days(splits.val, threshold)
        self.assertLess(np.mean((run.prob_up > 0.5) == actual), 0.6)


if __name__ == "__main__":
    unittest.main()
