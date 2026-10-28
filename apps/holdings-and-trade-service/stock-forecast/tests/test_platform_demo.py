import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.data import save_prices
from stock_forecast.platform_calibration import NO_RETRAIN_VARIANTS, PLATFORM_LSTM, calibration_rows
from stock_forecast.platform_demo import (load_platform_prices, platform_dataset, platform_market,
                                          scheduled_spikes, spike_summary)
from stock_forecast.platform_horizon import horizon_calibration_rows
from stock_forecast.windows import fit_scalers
from tests.helpers import FakeLstm, make_prices, snapshot_patches

HAS_TENSORFLOW = importlib.util.find_spec("tensorflow") is not None
SYMBOLS = ["AAPL", "MSFT", "XOM"]


def write_platform(folder: Path) -> None:
    for i, symbol in enumerate(SYMBOLS):
        save_prices(make_prices(i, start="2026-01-01", end="2026-12-31"), folder / f"{symbol.lower()}.csv")


class PlatformDataTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        write_platform(Path(self.folder.name))
        self.prices = load_platform_prices(Path(self.folder.name))

    def tearDown(self):
        self.folder.cleanup()

    def test_loads_every_symbol_by_upper_case_name(self):
        self.assertEqual(sorted(self.prices), SYMBOLS)

    def test_missing_export_is_a_clear_error(self):
        with tempfile.TemporaryDirectory() as empty, self.assertRaises(FileNotFoundError):
            load_platform_prices(Path(empty))

    def test_market_is_the_equal_weight_average_return(self):
        market = platform_market(self.prices)
        day = market.index[10]
        expected = np.mean([p["Close"].pct_change().loc[day] for p in self.prices.values()])
        self.assertAlmostEqual(market["Close"].pct_change().loc[day], expected)

    def test_chart_is_written(self):
        from stock_forecast.evaluate import plot_platform_demo

        rows = [{"task": "direction", "variant": v, "model": m, "accuracy": 0.5, "auc": 0.5, "threshold": None}
                for v, m in (("as trained", "LSTM direction"), ("rule", "Always up"))]
        rows += [{"task": "volatility", "variant": v, "model": "LSTM volatility", "accuracy": 0.6, "auc": 0.6,
                  "threshold": 0.008} for v in ("as trained", "recalibrated")]
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(plot_platform_demo(pd.DataFrame(rows), Path(folder) / "p.png", "t").exists())

    def test_dataset_uses_the_platform_market_in_place_of_spy(self):
        data = platform_dataset(self.prices, "AAPL")
        market_ret = platform_market(self.prices)["Close"].pct_change()
        np.testing.assert_allclose(data["spy_ret"], market_ret.loc[data.index])
        self.assertFalse(data.isna().any().any())


class SpikeTests(unittest.TestCase):
    def test_reads_only_volatility_spike_overlays(self):
        config_json = {"overlays": [
            {"id": "march", "condition": "volatility_spike", "start": "2026-03-16", "end": "2026-03-21"},
            {"id": "trend", "condition": "uptrend", "start": "2026-05-01", "end": "2026-05-29"}]}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sim.json"
            path.write_text(__import__("json").dumps(config_json), encoding="utf-8")
            self.assertEqual(scheduled_spikes(path),
                             [("march", pd.Timestamp("2026-03-16"), pd.Timestamp("2026-03-21"))])

    def test_the_repository_simulation_has_the_october_spike(self):
        if not config.PLATFORM_SIM_CONFIG.exists():
            self.skipTest("simulation config not present")
        self.assertIn("october-volatility", [spike_id for spike_id, _, _ in scheduled_spikes()])

    def test_summary_compares_spike_days_with_all_other_days(self):
        days = pd.bdate_range("2026-10-01", "2026-10-30")
        daily = pd.DataFrame({"prob_big": 0.2, "move": 0.005, "big": False}, index=days)
        spike = (days >= "2026-10-12") & (days <= "2026-10-16")
        daily.loc[spike, ["prob_big", "move", "big"]] = [0.7, 0.02, True]
        spikes = [("oct", pd.Timestamp("2026-10-12"), pd.Timestamp("2026-10-17")),
                  ("before data", pd.Timestamp("2026-03-16"), pd.Timestamp("2026-03-21"))]
        rows = spike_summary(daily, spikes)
        self.assertEqual(len(rows), 1)  # a spike with no forecasts is skipped
        row = rows[0]
        self.assertEqual(row["days"], 5)
        self.assertAlmostEqual(row["prob_in_spike"], 0.7)
        self.assertAlmostEqual(row["prob_other_days"], 0.2)
        self.assertAlmostEqual(row["prob_week_before"], 0.2)
        self.assertEqual(row["big_rate_in_spike"], 1.0)

    def test_spike_chart_is_written(self):
        from stock_forecast.evaluate import plot_spike

        days = pd.bdate_range("2026-09-01", "2026-11-30")
        daily = pd.DataFrame({"prob_big": 0.3, "move": 0.01, "big": False}, index=days)
        with tempfile.TemporaryDirectory() as folder:
            path = plot_spike(daily, [("oct", pd.Timestamp("2026-10-12"), pd.Timestamp("2026-10-17"))],
                              Path(folder) / "s.png", "t", "2026-09-01", "2026-11-30")
            self.assertTrue(path.exists())


class PlatformScoringTests(unittest.TestCase):
    """Tiny untrained models stand in for the saved ones, so no models/ folder is needed.

    They are Keras models where TensorFlow is installed and FakeLstm stand-ins
    otherwise, so CI checks the scoring windows and dates too. The real-data
    training rows come from synthetic snapshots.
    """

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        root = Path(cls.folder.name)
        write_platform(root / "platform")
        cls.prices = load_platform_prices(root / "platform")
        cls.data = platform_dataset(cls.prices, "AAPL")
        cls.patches = [mock.patch.object(config, "DIRECTION_MODEL_DIR", root / "direction"),
                       mock.patch.object(config, "VOLATILITY_MODEL_DIR", root / "volatility"), *snapshot_patches(root)]
        fake = None if HAS_TENSORFLOW else FakeLstm()
        for name, cols in (("direction", config.DIRECTION_FEATURES), ("volatility", config.VOLATILITY_FEATURES)):
            scalers = fit_scalers(cls.data, tuple(cols))
            if fake is None:
                from stock_forecast.lstm_model import build_direction_lstm, save_artifacts

                model = build_direction_lstm(lookback=10, n_features=len(cols), units=2, base_rate=0.5)
                save_artifacts(model, scalers, root / name)
            else:
                fake.save(root / name, 10, scalers)
        cls.patches += [fake] if fake else []
        for patch in cls.patches:
            patch.start()

    @classmethod
    def tearDownClass(cls):
        for patch in cls.patches:
            patch.stop()
        cls.folder.cleanup()

    def test_every_row_is_scored_on_the_same_days_after_the_warm_up(self):
        from stock_forecast.platform_demo import platform_rows

        rows, first, last = platform_rows(self.data)
        self.assertEqual(first, self.data.index[9])  # lookback 10: the first 9 rows are warm-up only
        self.assertEqual(last, self.data.index[-1])
        self.assertEqual({row["days"] for row in rows}, {len(self.data) - 9})
        self.assertEqual({(r["task"], r["variant"]) for r in rows},
                         {("direction", "as trained"), ("direction", "recalibrated"), ("direction", "rule"),
                          ("volatility", "as trained"), ("volatility", "recalibrated")})

    def test_daily_forecasts_are_dated_to_the_day_they_are_for(self):
        from stock_forecast.platform_demo import daily_big_move_probability

        daily = daily_big_move_probability(self.data)
        self.assertEqual(daily.index[0], self.data.index[10])  # lookback 10: first forecast is for row 10
        self.assertEqual(daily.index[-1], self.data.index[-1])
        day = daily.index[5]
        self.assertAlmostEqual(daily.loc[day, "move"], abs(self.data.loc[day, "ret"]))
        self.assertTrue(((daily["prob_big"] > 0) & (daily["prob_big"] < 1)).all())

    def test_recalibration_never_sees_the_scored_days(self):
        from stock_forecast.platform_demo import platform_rows

        changed = self.data.copy()
        changed.iloc[20:, changed.columns.get_loc("target")] *= 5  # only scored-period labels change
        before = pd.DataFrame(platform_rows(self.data)[0])
        after = pd.DataFrame(platform_rows(changed)[0])
        recal = (before["variant"] == "recalibrated") & (before["task"] == "volatility")
        self.assertEqual(set(before[recal]["threshold"]), set(after[recal]["threshold"]))

    def test_calibration_rows_score_every_symbol_and_add_the_platform_lstm_when_asked(self):
        load = lambda: self.prices  # noqa: E731
        plain = calibration_rows(["AAPL", "MSFT"], load=load, verbose=0)
        self.assertEqual(set(plain["symbol"]), {"AAPL", "MSFT"})
        self.assertEqual(set(plain["variant"]), set(NO_RETRAIN_VARIANTS))
        with FakeLstm(modules=("pooled",)):  # the platform LSTM is trained on the spot; a stand-in keeps this fast
            extra = calibration_rows(["AAPL", "MSFT"], with_platform_lstm=True, load=load, verbose=0)
        lstm = extra[extra["variant"] == PLATFORM_LSTM]
        self.assertEqual(set(lstm["symbol"]), {"AAPL", "MSFT"})
        # Trained on days to the validation end, so it is scored only on the months after it.
        self.assertGreater(min(lstm["month"]), config.PLATFORM_LSTM_VAL_END[:7])


class HorizonCalibrationRowsTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        write_platform(Path(folder.name))
        prices = load_platform_prices(Path(folder.name))
        self.load = lambda: prices

    def test_every_symbol_is_scored_and_the_platform_lstm_joins_when_asked(self):
        plain = horizon_calibration_rows(3, load=self.load, verbose=0)
        self.assertEqual(set(plain["symbol"]), set(SYMBOLS))
        self.assertNotIn(PLATFORM_LSTM, set(plain["variant"]))
        with FakeLstm() as fake:
            extra = horizon_calibration_rows(3, ["AAPL"], with_platform_lstm=True, load=self.load, verbose=0)
        self.assertEqual(len(fake.fits), 1)
        self.assertIn(PLATFORM_LSTM, set(extra["variant"]))
        self.assertEqual(set(extra["symbol"]), {"AAPL"})


if __name__ == "__main__":
    unittest.main()
