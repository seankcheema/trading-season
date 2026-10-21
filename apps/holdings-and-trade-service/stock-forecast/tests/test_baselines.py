import unittest

import numpy as np

from stock_forecast.baselines import (always_up, fit_linear, fit_logistic, mean_returns,
                                      moving_average_returns, naive_returns)
from stock_forecast.data import split_by_date
from tests.helpers import make_dataset


class SimpleBaselineTests(unittest.TestCase):
    # Hand-check the forecasts used as minimum bars for more complex models.
    def setUp(self):
        self.splits = split_by_date(make_dataset())

    def test_naive_predicts_no_change(self):
        np.testing.assert_array_equal(naive_returns(4), np.zeros(4))

    def test_mean_uses_the_training_target(self):
        predicted = mean_returns(self.splits.train, 3)
        np.testing.assert_allclose(predicted, [self.splits.train["target"].mean()] * 3)

    def test_always_up_is_all_true(self):
        self.assertTrue(always_up(5).all())
        self.assertEqual(always_up(5).dtype, bool)

    def test_moving_average_matches_a_manual_average(self):
        val, train = self.splits.val, self.splits.train
        predicted = moving_average_returns(val, window=30, history=train)
        manual = val["ret"].iloc[11:41].mean()  # day 40 averages days 11..40
        self.assertAlmostEqual(predicted[40], manual)
        first = np.r_[train["ret"].iloc[-29:].to_numpy(), val["ret"].iloc[0]].mean()
        self.assertAlmostEqual(predicted[0], first)

    def test_moving_average_with_history_has_no_gaps(self):
        predicted = moving_average_returns(self.splits.val, history=self.splits.train)
        self.assertEqual(len(predicted), len(self.splits.val))
        self.assertFalse(np.isnan(predicted).any())


class RegressionBaselineTests(unittest.TestCase):
    # Known synthetic relationships verify that each estimator learns its task.
    def test_linear_regression_learns_a_linear_rule(self):
        rng = np.random.default_rng(0)
        X = rng.normal(size=(500, 3))
        y = X @ np.array([0.5, -0.2, 0.1]) + 0.01
        model = fit_linear(X, y)
        np.testing.assert_allclose(model.coef_, [0.5, -0.2, 0.1], atol=1e-8)

    def test_logistic_regression_returns_up_down_calls(self):
        rng = np.random.default_rng(0)
        X = rng.normal(size=(500, 3))
        y_up = X[:, 0] > 0
        model = fit_logistic(X, y_up)
        self.assertGreater((model.predict(X) == y_up).mean(), 0.95)


if __name__ == "__main__":
    unittest.main()
