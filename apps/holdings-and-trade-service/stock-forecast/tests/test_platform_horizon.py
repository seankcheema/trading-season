"""Platform horizon tests: the label looks ahead, the features do not, and no fit sees the days it is scored on."""
import unittest

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.platform_calibration import ONE_ANSWER, PERSISTENCE, PLATFORM_LSTM, summarise
from stock_forecast.platform_horizon import (CALIBRATED, SAME_AS_LAST, horizon_daily, horizon_probabilities, horizon_rows,
                                             past_volatility)
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


if __name__ == "__main__":
    unittest.main()
