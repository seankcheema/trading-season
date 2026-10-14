import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from stock_forecast.evaluate import (append_results, direction_accuracy, mae, plot_actual_vs_predicted,
                                     plot_direction_accuracy, plot_loss, plot_walk_forward, predicted_prices,
                                     rmse, score)


class MetricTests(unittest.TestCase):
    # Pin metric units, shape checks, and the convention for calling an up day.
    def test_rmse_and_mae(self):
        actual, predicted = np.array([0.01, -0.02, 0.03]), np.array([0.0, 0.0, 0.0])
        self.assertAlmostEqual(rmse(actual, predicted), np.sqrt((0.0001 + 0.0004 + 0.0009) / 3))
        self.assertAlmostEqual(mae(actual, predicted), 0.02)

    def test_shape_mismatch_is_an_error(self):
        with self.assertRaises(ValueError):
            rmse(np.zeros(3), np.zeros(4))

    def test_direction_accuracy(self):
        actual = np.array([0.01, -0.02, 0.03, -0.01])
        self.assertEqual(direction_accuracy(actual, np.array([True, False, False, False])), 0.75)

    def test_naive_forecast_has_no_direction_score(self):
        row = score("Naive", np.array([0.01, -0.01]), np.zeros(2), include_direction=False)
        self.assertIsNone(row["direction_accuracy"])
        self.assertAlmostEqual(row["return_rmse"], 0.01)

    def test_direction_comes_from_predicted_returns(self):
        row = score("Model", np.array([0.01, -0.01]), np.array([0.002, 0.001]))
        self.assertEqual(row["direction_accuracy"], 0.5)

    def test_missing_forecasts_are_an_error(self):
        with self.assertRaises(ValueError):
            score("Model", np.zeros(2), np.array([np.nan, 0.0]))

    def test_predicted_prices(self):
        np.testing.assert_allclose(predicted_prices([100.0, 200.0], [0.01, -0.5]), [101.0, 100.0])


class ReportTests(unittest.TestCase):
    # Reports preserve every run and write charts as ordinary image files.
    def test_results_log_appends_every_run(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "results.csv"
            append_results([score("A", np.zeros(2), np.zeros(2))], path, run="first")
            append_results([score("B", np.zeros(2), np.zeros(2))], path, run="second")
            log = pd.read_csv(path)
        self.assertEqual(list(log["run"]), ["first", "second"])
        self.assertIn("logged_at", log.columns)

    def test_charts_are_written(self):
        dates = pd.bdate_range("2024-01-01", periods=80)
        table = pd.DataFrame([{"model": "A", "direction_accuracy": 0.52}, {"model": "B", "direction_accuracy": 0.49}])
        walk = pd.DataFrame([{"year": 2018, "model": "A", "direction_accuracy": 0.5},
                             {"year": 2019, "model": "A", "direction_accuracy": 0.53}])
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            paths = [
                plot_actual_vs_predicted(dates, np.arange(80.0), np.arange(80.0) + 1, folder / "lag.png", "Lag"),
                plot_direction_accuracy(table, 0.51, folder / "direction.png", "Direction"),
                plot_loss({"loss": [1.0, 0.8], "val_loss": [1.1, 0.9]}, folder / "loss.png"),
                plot_walk_forward(walk, folder / "walk.png"),
            ]
            for path in paths:
                self.assertGreater(path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
