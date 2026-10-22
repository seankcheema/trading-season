"""Platform horizon tests: the label looks ahead, the features do not, and no fit sees the days it is scored on."""
import unittest

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.platform_calibration import ONE_ANSWER, PERSISTENCE, PLATFORM_LSTM, summarise
from stock_forecast.platform_horizon import (CALIBRATED, OWN_MEDIAN, SAME_AS_LAST, STACKED, ensemble_platform_lstm,
                                             horizon_daily, horizon_probabilities, horizon_rows, past_volatility,
                                             relative_level, stacked_probabilities)
from tests.helpers import make_prices


def platform_like() -> pd.DataFrame:
    """A full platform year of random-walk bars, with the warm-up the indicators need before it."""
    from stock_forecast.data import add_indicators, build_dataset
    prices = build_dataset(make_prices(0, start="2025-06-01", end="2026-12-31"),
                           make_prices(1, start="2025-06-01", end="2026-12-31", start_price=300.0))
    return add_indicators(prices).loc["2026-01-01":]


class LabelTests(unittest.TestCase):
    def test_past_volatility_is_known_at_the_close(self):
        r = pd.Series([0.01, -0.02, 0.03, 0.0], index=pd.bdate_range("2026-01-05", periods=4))
        np.testing.assert_allclose(past_volatility(r, 2).iloc[1], np.sqrt((0.01**2 + 0.02**2) / 2))
        self.assertTrue(np.isnan(past_volatility(r, 2).iloc[0]))

    def test_label_looks_ahead_and_features_do_not(self):
        data = platform_like()
        daily = horizon_daily(data, 5)
        day = daily.index[50]
        pos = data.index.get_loc(day)
        expected = np.sqrt((data["ret"].iloc[pos + 1 : pos + 6] ** 2).mean())
        self.assertAlmostEqual(daily.loc[day, "target"], expected)
        self.assertEqual(daily.loc[day, "abs_ret"], data.loc[day, "abs_ret"])
        # The last five days have no complete window and carry no label.
        self.assertTrue(daily["target"].tail(5).isna().all())

    def test_horizon_below_one_is_rejected(self):
        with self.assertRaises(ValueError):
            horizon_daily(platform_like(), 0)


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.daily = horizon_daily(platform_like(), 5)

    def test_every_variant_quotes_a_probability(self):
        scorable = self.daily.dropna(subset=["target"])
        probs = horizon_probabilities(scorable.iloc[:80], scorable.iloc[80:100])
        self.assertEqual(set(probs), {PERSISTENCE, ONE_ANSWER, SAME_AS_LAST})
        for p in probs.values():
            self.assertEqual(len(p), 20)
            self.assertTrue(((p >= 0) & (p <= 1)).all())

    def test_fits_leave_out_the_days_whose_labels_reach_into_the_month(self):
        # Changing the first five days of a month changes labels of the five days before it; those must not be fitted.
        before = horizon_rows(self.daily, "AAPL", 5, min_days=40)
        month = before["month"].iloc[-1]
        first = pd.Timestamp(month + "-01")
        changed = self.daily.copy()
        inside = (changed.index >= first) & (changed.index < first + pd.Timedelta(days=8))
        changed.loc[inside, "target"] *= 10  # only labels inside the month move
        after = horizon_rows(changed, "AAPL", 5, min_days=40)
        earlier = before["month"] < month
        pd.testing.assert_frame_equal(before[earlier].reset_index(drop=True), after[earlier].reset_index(drop=True))
        same_month = (before["month"] == month) & (before["variant"] == PERSISTENCE)
        np.testing.assert_allclose(before.loc[same_month, "prob"], after.loc[same_month, "prob"])

    def test_extra_variant_joins_the_table_and_the_gate_uses_the_horizon_rule(self):
        series = pd.Series(0.9, index=self.daily.index)
        rows = horizon_rows(self.daily, "AAPL", 5, min_days=40, extra={PLATFORM_LSTM: series})
        table = summarise(rows).set_index("variant")
        self.assertIn(PLATFORM_LSTM, table.index)
        # A constant score has no ranking to calibrate: the mapping falls back to the base rate.
        self.assertIn(PLATFORM_LSTM + CALIBRATED, table.index)
        rule = max(table.loc[ONE_ANSWER, "accuracy"], table.loc[SAME_AS_LAST, "accuracy"])
        self.assertEqual(table.loc[PERSISTENCE, "rule_accuracy"], rule)

    def test_calibration_uses_only_earlier_scored_days_and_keeps_the_ranking(self):
        rng = np.random.default_rng(1)
        # A score that carries signal: higher when the label is true, plus noise.
        signal = 0.35 + 0.3 * self.daily["big"].to_numpy() + rng.normal(0, 0.08, len(self.daily))
        series = pd.Series(np.clip(signal, 0.01, 0.99), index=self.daily.index)
        series = series[series.index >= "2026-07-01"]  # like the platform LSTM, scored only after its training span
        rows = horizon_rows(self.daily, "AAPL", 5, min_days=40, extra={PLATFORM_LSTM: series})
        last = rows["month"].iloc[-1]
        raw = rows[(rows["month"] == last) & (rows["variant"] == PLATFORM_LSTM)]["prob"].to_numpy()
        cal = rows[(rows["month"] == last) & (rows["variant"] == PLATFORM_LSTM + CALIBRATED)]["prob"].to_numpy()
        self.assertEqual(len(cal), len(raw))
        np.testing.assert_array_equal(np.argsort(raw), np.argsort(cal))
        # The first month the model covers has no earlier scored days to calibrate on, so only the raw score appears.
        first = rows[rows["variant"] == PLATFORM_LSTM]["month"].iloc[0]
        self.assertNotIn(PLATFORM_LSTM + CALIBRATED, set(rows[rows["month"] == first]["variant"]))




class SecondLayerTests(unittest.TestCase):
    def test_relative_level_is_the_percentile_among_the_previous_window(self):
        series = pd.Series(np.arange(50, dtype=float), index=pd.bdate_range("2026-01-01", periods=50))
        level = relative_level(series, window=40)
        # A rising series is always above every earlier value: percentile 1.0, from the 41st reading on.
        self.assertEqual(len(level), 10)
        self.assertTrue((level == 1.0).all())
        flat = relative_level(pd.Series(np.ones(45), index=pd.bdate_range("2026-01-01", periods=45)), window=40)
        self.assertTrue((flat == 0.5).all())  # ties sit at the median

    def test_stacker_needs_enough_scored_trailing_days(self):
        from tests.test_platform_horizon import platform_like
        daily = horizon_daily(platform_like(), 5).dropna(subset=["target"])
        trailing, part = daily.iloc[:80], daily.iloc[80:100]
        series = pd.Series(0.6, index=daily.index[70:100])  # ten trailing days only
        self.assertIsNone(stacked_probabilities(trailing, part, series))
        series = pd.Series(np.linspace(0.2, 0.8, 100), index=daily.index[:100])
        out = stacked_probabilities(trailing, part, series)
        self.assertEqual(len(out), 20)
        self.assertTrue(((out >= 0) & (out <= 1)).all())

    def test_monthly_rows_add_own_median_and_stacked_variants_for_a_model(self):
        daily = horizon_daily(platform_like(), 5)
        rng = np.random.default_rng(3)
        series = pd.Series(rng.uniform(0.2, 0.8, len(daily)), index=daily.index)
        rows = horizon_rows(daily, "AAPL", 5, min_days=40, extra={"M": series})
        variants = set(rows["variant"])
        self.assertIn("M" + OWN_MEDIAN, variants)
        self.assertIn("M" + STACKED, variants)
        own = rows[rows["variant"] == "M" + OWN_MEDIAN]["prob"]
        self.assertTrue(((own >= 0) & (own <= 1)).all())

    def test_ensemble_averages_the_members(self):
        from unittest import mock
        import stock_forecast.platform_horizon as module
        index = pd.bdate_range("2026-07-01", periods=5)
        calls = []

        def fake(datasets, horizon, seed, feature_cols, verbose, **kwargs):
            calls.append(seed)
            return {"AAPL": pd.Series(np.full(5, 0.2 + 0.1 * (seed - 42)), index=index)}

        with mock.patch.object(module, "platform_horizon_lstm", side_effect=fake):
            out = ensemble_platform_lstm({"AAPL": pd.DataFrame(index=index)}, 5, seeds=3)
        self.assertEqual(calls, [42, 43, 44])
        np.testing.assert_allclose(out["AAPL"].to_numpy(), 0.3)

    def test_relative_label_fits_the_model_on_the_rolling_usual_level(self):
        from unittest import mock
        import stock_forecast.pooled as pooled
        from stock_forecast.platform_horizon import platform_horizon_lstm
        data = platform_like()
        seen = {}

        def fake(periods, feature_cols, lookback, units, seed, verbose, purge, label=None):
            seen["label"], seen["periods"] = label, periods
            return {symbol: np.full(len(part), 0.5) for symbol, (_, _, part, _) in periods.items()}

        with mock.patch.object(pooled, "pooled_volatility_predictions", side_effect=fake):
            platform_horizon_lstm({"AAPL": data}, 5, verbose=0)
            self.assertIsNone(seen["label"])
            self.assertNotIn("big", seen["periods"]["AAPL"][0].columns)
            out = platform_horizon_lstm({"AAPL": data}, 5, verbose=0, relative_label=True)
        self.assertEqual(seen["label"], "big")
        train = seen["periods"]["AAPL"][0]
        daily = horizon_daily(data, 5)
        self.assertTrue(train.index.isin(daily.index).all())
        pd.testing.assert_series_equal(train["big"], daily.loc[train.index, "big"], check_names=False)
        self.assertEqual(out["AAPL"].index[0], seen["periods"]["AAPL"][2].index[0])


if __name__ == "__main__":
    unittest.main()
