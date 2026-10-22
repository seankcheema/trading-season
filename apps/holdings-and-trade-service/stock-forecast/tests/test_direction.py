"""Direction model tests: labels, probability metrics, baselines and the LSTM."""
import importlib.util
import tempfile
import unittest

import numpy as np

from stock_forecast.data import add_indicators, split_by_date
from stock_forecast.evaluate import confidence_buckets, direction_metrics, plot_confidence, plot_up_probability
from stock_forecast.pipeline import direction_baselines, direction_fold, direction_row, training_up_rate
from stock_forecast.walk_forward import walk_forward_folds
from stock_forecast.windows import direction_labels, fit_scalers, make_windows
from tests.helpers import make_dataset

HAS_TENSORFLOW = importlib.util.find_spec("tensorflow") is not None


class DirectionMetricTests(unittest.TestCase):
    # Pin what each probability metric means on small hand-checked cases.
    def test_perfect_probabilities(self):
        m = direction_metrics(np.array([0.01, -0.01, 0.02, -0.02]), np.array([1.0, 0.0, 1.0, 0.0]), base_rate=0.5)
        self.assertEqual(m["direction_accuracy"], 1.0)
        self.assertEqual(m["balanced_accuracy"], 1.0)
        self.assertEqual(m["auc"], 1.0)
        self.assertEqual(m["brier_skill"], 1.0)

    def test_quoting_the_base_rate_has_zero_skill_and_calls_up_every_day(self):
        actual = np.array([0.01, -0.01, 0.02, 0.03, -0.02])
        m = direction_metrics(actual, np.full(5, 0.55), base_rate=0.55)
        self.assertAlmostEqual(m["brier_skill"], 0.0)
        self.assertEqual(m["up_call_rate"], 1.0)
        self.assertEqual(m["direction_accuracy"], 0.6)
        self.assertEqual(m["balanced_accuracy"], 0.5)
        self.assertEqual(m["auc"], 0.5)

    def test_zero_return_is_not_an_up_day(self):
        m = direction_metrics(np.array([0.0, 0.01]), np.array([0.2, 0.8]), base_rate=0.5)
        self.assertEqual(m["direction_accuracy"], 1.0)

    def test_invalid_probabilities_are_rejected(self):
        with self.assertRaises(ValueError):
            direction_metrics(np.zeros(2), np.array([0.5, 1.2]), base_rate=0.5)
        with self.assertRaises(ValueError):
            direction_metrics(np.zeros(2), np.array([0.5, np.nan]), base_rate=0.5)
        with self.assertRaises(ValueError):
            direction_metrics(np.zeros(3), np.array([0.5, 0.5]), base_rate=0.5)

    def test_confidence_buckets_are_equal_sized_and_ordered(self):
        rng = np.random.default_rng(0)
        prob = rng.uniform(0, 1, 100)
        actual = np.where(prob > 0.5, 0.01, -0.01)  # every call right
        table = confidence_buckets(actual, prob, buckets=5)
        self.assertEqual(list(table["days"]), [20] * 5)
        self.assertTrue(table["min_confidence"].is_monotonic_increasing)
        self.assertTrue((table["accuracy"] == 1.0).all())

    def test_confidence_buckets_survive_a_constant_model(self):
        table = confidence_buckets(np.array([0.01, -0.01] * 10), np.full(20, 0.53), buckets=5)
        self.assertEqual(table["days"].sum(), 20)

    def test_charts_are_written(self):
        actual = np.array([0.01, -0.01] * 30)
        prob = np.linspace(0.3, 0.7, 60)
        with tempfile.TemporaryDirectory() as folder:
            path = plot_confidence(confidence_buckets(actual, prob), 0.5, f"{folder}/c.png", "t")
            self.assertTrue(path.exists())
            dates = make_dataset().index[:60]
            self.assertTrue(plot_up_probability(dates, prob, actual, f"{folder}/p.png", "t").exists())


class DirectionLabelTests(unittest.TestCase):
    def test_labels_align_with_windows(self):
        splits = split_by_date(make_dataset())
        scalers = fit_scalers(splits.train)
        X, _ = make_windows(splits.val, scalers, 10, history=splits.train)
        labels = direction_labels(splits.val, 10, history=splits.train)
        self.assertEqual(len(labels), len(X))
        np.testing.assert_array_equal(labels, (splits.val["target"] > 0).astype(float))
        no_history = direction_labels(splits.train, 10)
        np.testing.assert_array_equal(no_history, (splits.train["target"].iloc[9:] > 0).astype(float))


class DirectionBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(add_indicators(make_dataset()))
        cls.probs = direction_baselines(cls.splits.train, cls.splits.val, history=cls.splits.train)

    def test_every_baseline_gives_a_probability_for_every_day(self):
        self.assertEqual(len(self.probs), 3)
        for name, prob in self.probs.items():
            self.assertEqual(prob.shape, (len(self.splits.val),), name)
            self.assertTrue(((prob >= 0) & (prob <= 1)).all(), name)

    def test_base_rate_excludes_the_label_that_crosses_into_validation(self):
        expected = (self.splits.train["target"].iloc[:-1] > 0).mean()
        self.assertAlmostEqual(training_up_rate(self.splits.train), expected)
        np.testing.assert_allclose(self.probs["Always up (training up-rate)"], expected)

    def test_no_direction_baseline_beats_a_coin_flip_on_a_random_walk(self):
        """Leak alarm: 60%+ on random-walk data means future data reached the inputs."""
        actual = self.splits.val["target"].to_numpy()
        base = training_up_rate(self.splits.train)
        for name, prob in self.probs.items():
            row = direction_row(name, actual, prob, base, "validation")
            self.assertLess(row["direction_accuracy"], 0.6, name)
            self.assertLess(row["auc"], 0.6, name)

    def test_walk_forward_fold_without_lstm(self):
        fold = walk_forward_folds(add_indicators(make_dataset()), years=[2019])[0]
        rows = direction_fold(fold)
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(row["split"] == "walk-forward 2019" for row in rows))


@unittest.skipUnless(HAS_TENSORFLOW, "TensorFlow is not installed")
class DirectionLstmTests(unittest.TestCase):
    # Small, fast runs: these check interfaces, reproducibility and leaks, not skill.
    @classmethod
    def setUpClass(cls):
        dataset = add_indicators(make_dataset())
        cls.splits = split_by_date(dataset)
        cls.train = cls.splits.train.iloc[-500:]

    def test_untrained_model_quotes_the_base_rate(self):
        from stock_forecast.lstm_model import build_direction_lstm, predict_up_probability

        model = build_direction_lstm(lookback=10, n_features=2, units=4, dropout=0.0, base_rate=0.53)
        # With zero inputs the LSTM state stays zero, so the output is the bias alone.
        prob = predict_up_probability(model, np.zeros((3, 10, 2)))
        np.testing.assert_allclose(prob, 0.53, rtol=1e-5)

    def test_bad_base_rate_is_rejected(self):
        from stock_forecast.lstm_model import build_direction_lstm

        with self.assertRaises(ValueError):
            build_direction_lstm(lookback=10, n_features=1, base_rate=1.0)

    def test_trains_predicts_probabilities_and_round_trips(self):
        from stock_forecast.lstm_model import load_artifacts, predict_up_probability, save_artifacts
        from stock_forecast.pipeline import direction_lstm_predictions

        run = direction_lstm_predictions(self.train, self.splits.val.iloc[:120], self.splits.val, history=self.train,
                                         feature_cols=("ret", "volatility_10"), lookback=10, units=4)
        self.assertEqual(run.prob_up.shape, (len(self.splits.val),))
        self.assertTrue(((run.prob_up > 0) & (run.prob_up < 1)).all())
        self.assertLess(np.mean((run.prob_up > 0.5) == (self.splits.val["target"] > 0)), 0.6)
        X, _ = make_windows(self.splits.val, run.scalers, 10, history=self.train)
        with tempfile.TemporaryDirectory() as folder:
            save_artifacts(run.model, run.scalers, folder)
            model, scalers = load_artifacts(folder)
            np.testing.assert_allclose(predict_up_probability(model, X), run.prob_up, rtol=1e-5)
            self.assertEqual(scalers.feature_cols, ("ret", "volatility_10"))


if __name__ == "__main__":
    unittest.main()
