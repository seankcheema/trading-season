import tempfile
import unittest
from pathlib import Path

import numpy as np

from stock_forecast import config
from stock_forecast.data import add_indicators, split_by_date
from stock_forecast.pipeline import (big_move_threshold, classical_fold, classical_predictions, direction_fold,
                                     event_lstm_predictions, final_test_prediction, final_volatility_prediction,
                                     load_direction_dataset, lstm_fold, score_all, volatility_fold)
from stock_forecast.walk_forward import walk_forward_folds
from stock_forecast.windows import fit_scalers
from tests.helpers import FakeLstm, make_dataset, snapshot_patches


class ClassicalPipelineTests(unittest.TestCase):
    # Same-date forecasts let us compare all classical models fairly.
    @classmethod
    def setUpClass(cls):
        cls.splits = split_by_date(make_dataset())
        cls.preds, cls.info = classical_predictions(cls.splits.train, cls.splits.val, history=cls.splits.train)
        cls.rows = score_all(cls.preds, cls.splits.val["target"].to_numpy(), split="validation")

    def test_every_model_forecasts_every_validation_day(self):
        self.assertEqual(len(self.preds), 7)
        for name, prediction in self.preds.items():
            for values in (prediction.returns, prediction.up):
                if values is not None:
                    self.assertEqual(len(values), len(self.splits.val), name)
                    self.assertFalse(np.isnan(np.asarray(values, dtype=float)).any(), name)

    def test_baseline_score_set_is_six_models_on_all_validation_days(self):
        preds, _ = classical_predictions(
            self.splits.train, self.splits.val, history=self.splits.train, include_var=False
        )
        self.assertEqual(list(preds), [
            "Naive (return = 0)", "Always up", "Training-average return",
            "30-day average return", "Linear regression", "Logistic regression",
        ])
        for prediction in preds.values():
            forecasts = prediction.returns if prediction.returns is not None else prediction.up
            self.assertEqual(len(forecasts), len(self.splits.val))

    def test_training_average_excludes_label_that_crosses_validation_boundary(self):
        preds, _ = classical_predictions(
            self.splits.train, self.splits.val, history=self.splits.train, include_var=False
        )
        actual_fit_mean = self.splits.train.iloc[:-1]["target"].mean()
        expected = np.full(len(self.splits.val), actual_fit_mean)
        np.testing.assert_allclose(preds["Training-average return"].returns, expected)

    def test_var_order_is_chosen_within_range(self):
        self.assertIn(self.info["var_order"], range(1, 11))
        self.assertTrue(any(name.startswith("VAR(") for name in self.preds))

    def test_no_model_beats_a_coin_flip_on_a_random_walk(self):
        """Leak alarm: random-walk data has nothing to learn, so 60%+ means a bug."""
        for row in self.rows:
            if row["direction_accuracy"] is not None:
                self.assertLess(row["direction_accuracy"], 0.6, row["model"])

    def test_walk_forward_fold_scores_every_model(self):
        fold = walk_forward_folds(make_dataset(), years=[2019])[0]
        rows = classical_fold(fold)
        self.assertEqual(len(rows), 7)
        self.assertIn("VAR", [row["model"] for row in rows])

    def test_final_test_picks_the_requested_model(self):
        name, prediction = final_test_prediction("var", self.splits)
        self.assertTrue(name.startswith("VAR("))
        self.assertEqual(len(prediction.returns), len(self.splits.test))



class EventLstmTests(unittest.TestCase):
    """The code around the LSTM, with a stand-in model: purges, scalers and the scored days."""

    def setUp(self):
        data = add_indicators(make_dataset())
        self.train, self.val, self.part = data.iloc[:300], data.iloc[300:400], data.iloc[400:450]
        self.fake = FakeLstm().start()
        self.addCleanup(self.fake.stop)

    def run_model(self, train=None, purge=1):
        return event_lstm_predictions(self.train if train is None else train, self.val, self.part, self.val,
                                      ("ret", "abs_ret"), lookback=10, units=2, big_move=0.01, purge=purge)

    def test_the_last_purge_labels_of_train_and_val_are_never_fitted(self):
        for purge in (1, 5):
            self.run_model(purge=purge)
            fit = self.fake.fits[-1]
            self.assertEqual(len(fit["y_train"]), len(self.train) - purge - 10 + 1)
            self.assertEqual(len(fit["y_val"]), len(self.val) - purge)

    def test_purged_labels_do_not_change_the_fit(self):
        self.run_model(purge=5)
        changed = self.train.copy()
        changed.iloc[-5:, changed.columns.get_loc("target")] = 1.0  # labels that reach into validation
        self.run_model(changed, purge=5)
        first, second = self.fake.fits
        for key in first:
            np.testing.assert_array_equal(first[key], second[key])

    def test_every_scored_day_gets_one_probability_from_training_scalers(self):
        run = self.run_model()
        self.assertEqual(run.prob_up.shape, (len(self.part),))
        self.assertTrue(((run.prob_up > 0) & (run.prob_up < 1)).all())
        expected = fit_scalers(self.train.iloc[:-1], ("ret", "abs_ret"))
        np.testing.assert_allclose(run.scalers.features.mean_, expected.features.mean_)


class LstmFoldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fold = walk_forward_folds(add_indicators(make_dataset()), years=[2019])[0]

    def test_each_walk_forward_step_adds_its_lstm_row(self):
        with FakeLstm() as fake:
            returns = lstm_fold(self.fold)
            direction = direction_fold(self.fold, with_lstm=True)
            volatility = volatility_fold(self.fold, with_lstm=True)
        self.assertEqual([r["model"] for r in returns], ["LSTM"])
        self.assertIn("LSTM direction", [r["model"] for r in direction])
        self.assertIn("LSTM volatility", [r["model"] for r in volatility])
        self.assertTrue(all(r["split"] == "walk-forward 2019" for r in returns + direction + volatility))
        self.assertEqual(len(fake.fits), 3)
        self.assertEqual({r["threshold"] for r in volatility}, {big_move_threshold(self.fold.train)})


class FinalLstmPredictionTests(unittest.TestCase):
    """The saved models are scored on the test days with validation as the windows' history."""

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.patches = snapshot_patches(Path(cls.folder.name))
        for patch in cls.patches:
            patch.start()
        cls.splits = split_by_date(load_direction_dataset())

    @classmethod
    def tearDownClass(cls):
        for patch in cls.patches:
            patch.stop()
        cls.folder.cleanup()

    def test_saved_direction_and_volatility_models_score_every_test_day(self):
        with FakeLstm() as fake:
            for directory, cols in ((config.DIRECTION_MODEL_DIR, config.DIRECTION_FEATURES),
                                    (config.VOLATILITY_MODEL_DIR, config.VOLATILITY_FEATURES)):
                fake.save(directory, 20, fit_scalers(self.splits.train, tuple(cols)))
            fake.save(config.MODELS_DIR, config.LOOKBACK, fit_scalers(self.splits.train))
            name, prediction = final_test_prediction("lstm-direction", self.splits)
            vol_name, prob, threshold = final_volatility_prediction(self.splits)
            returns_name, returns = final_test_prediction("lstm", self.splits)
        n = len(self.splits.test)
        self.assertEqual(name, f"LSTM direction ({len(config.DIRECTION_FEATURES)} inputs, 20-day window)")
        self.assertEqual(prediction.prob_up.shape, (n,))
        np.testing.assert_array_equal(prediction.up, prediction.prob_up > config.DIRECTION_THRESHOLD)
        self.assertTrue(vol_name.startswith("LSTM volatility"))
        self.assertEqual(prob.shape, (n,))
        self.assertEqual(threshold, big_move_threshold(self.splits.train))
        self.assertEqual((returns_name, len(returns.returns)), ("LSTM", n))


if __name__ == "__main__":
    unittest.main()
