import unittest

import numpy as np

from stock_forecast.var_model import (fit_var, forecast_next, information_criterion, lag_design,
                                      one_step_forecasts, select_order)
from tests.helpers import simulate_var

A1 = [[0.5, 0.1], [-0.2, 0.3]]
C = [0.1, -0.05]


class LagDesignTests(unittest.TestCase):
    # Small matrices make lag order and coefficient layout easy to inspect.
    def test_rows_hold_a_constant_then_each_lag(self):
        values = np.arange(12, dtype=float).reshape(6, 2)  # rows: [0,1], [2,3], ...
        Z, Y = lag_design(values, order=2)
        self.assertEqual(Z.shape, (4, 1 + 2 * 2))
        np.testing.assert_array_equal(Y[0], values[2])
        np.testing.assert_array_equal(Z[0], [1, 2, 3, 0, 1])  # 1, then lag 1 = values[1], lag 2 = values[0]

    def test_too_few_rows_is_an_error(self):
        with self.assertRaises(ValueError):
            lag_design(np.zeros((2, 2)), order=2)


class FitTests(unittest.TestCase):
    def test_recovers_known_coefficients(self):
        data = simulate_var([A1], C, n=5000)
        result = fit_var(data, order=1)
        np.testing.assert_allclose(result.coefs[0], A1, atol=0.05)
        np.testing.assert_allclose(result.intercept, C, atol=0.05)
        self.assertEqual(result.columns, ("a", "b"))
        self.assertEqual(result.n_obs, 4999)

    def test_residual_covariance_matches_the_noise(self):
        result = fit_var(simulate_var([A1], C, n=5000, noise=0.5), order=1)
        np.testing.assert_allclose(result.residual_cov, np.eye(2) * 0.25, atol=0.03)

    def test_aic_prefers_the_true_order(self):
        A2 = [[0.0, 0.0], [0.0, 0.0]]
        A2_strong = [[0.3, 0.0], [0.0, -0.3]]
        data = simulate_var([A2, A2_strong], C, n=5000)  # lag 1 does nothing, lag 2 matters
        self.assertIn(select_order(data, max_order=6), (2, 3))

    def test_extra_lags_cost_aic_when_they_add_nothing(self):
        data = simulate_var([A1], C, n=5000)
        one = information_criterion(fit_var(data.iloc[4:], 1))
        five = information_criterion(fit_var(data, 5))
        self.assertLess(one, five)


class ForecastTests(unittest.TestCase):
    # Forecast tests check the equation and prove later inputs cannot change earlier predictions.
    def setUp(self):
        self.data = simulate_var([A1], C, n=600)
        self.result = fit_var(self.data.iloc[:400], order=2)

    def test_forecast_matches_the_formula(self):
        recent = self.data.iloc[398:400].to_numpy()
        expected = self.result.intercept + self.result.coefs[0] @ recent[-1] + self.result.coefs[1] @ recent[-2]
        np.testing.assert_allclose(forecast_next(self.result, recent), expected)

    def test_history_gives_every_row_a_forecast(self):
        part, history = self.data.iloc[400:], self.data.iloc[:400]
        forecasts = one_step_forecasts(self.result, part, history)
        self.assertEqual(forecasts.shape, (len(part), 2))
        first = forecast_next(self.result, self.data.iloc[399:401].to_numpy())
        np.testing.assert_allclose(forecasts[0], first)

    def test_forecasts_use_only_the_past(self):
        part, history = self.data.iloc[400:].copy(), self.data.iloc[:400]
        before = one_step_forecasts(self.result, part, history)
        part.iloc[50:] = 99.0
        after = one_step_forecasts(self.result, part, history)
        np.testing.assert_allclose(before[:50], after[:50])


if __name__ == "__main__":
    unittest.main()
