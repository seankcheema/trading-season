import unittest

import numpy as np

from stock_forecast.data import split_by_date
from stock_forecast.pipeline import classical_fold, classical_predictions, final_test_prediction, score_all
from stock_forecast.walk_forward import walk_forward_folds
from tests.helpers import make_dataset


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


if __name__ == "__main__":
    unittest.main()
