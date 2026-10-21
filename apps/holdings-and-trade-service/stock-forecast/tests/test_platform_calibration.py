"""Platform calibration tests: no month sees its own days, every variant quotes a probability, the gate is a rule."""
import tempfile
import unittest
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_platform_calibration
from stock_forecast.platform_calibration import (BLEND, LSTM_CALIBRATED, NO_RETRAIN_VARIANTS, ONE_ANSWER,
                                                 PLATFORM_LSTM, monthly_rows, platform_scores, summarise, usual_move,
                                                 variant_probabilities)


def fake_daily(seed: int = 0, days: int = 200) -> pd.DataFrame:
    """Scores and moves with a planted link: a higher score goes with a bigger move."""
    rng = np.random.default_rng(seed)
    index = pd.bdate_range("2026-01-02", periods=days, name="forecast_for")
    score = rng.uniform(0.05, 0.6, days)
    move = np.abs(rng.normal(0, 0.01, days)) * (0.5 + score)
    frame = pd.DataFrame({"prob_big": score, "move": move}, index=index)
    frame["abs_ret"] = np.roll(move, 1)
    frame[f"volatility_{config.VOLATILITY_WINDOW}"] = pd.Series(move).rolling(10, min_periods=1).std().fillna(0.01).to_numpy()
    return frame


def with_labels(daily: pd.DataFrame) -> pd.DataFrame:
    daily = daily.assign(usual=usual_move(daily, 40))
    return daily.assign(big=daily["move"] > daily["usual"]).dropna(subset=["usual"])


class VariantTests(unittest.TestCase):
    def setUp(self):
        self.daily = with_labels(fake_daily())
        self.trailing, self.part = self.daily.iloc[:100], self.daily.iloc[100:120]

    def test_every_variant_quotes_a_probability_for_every_day(self):
        probs = variant_probabilities(self.trailing, self.part)
        self.assertEqual(set(probs), set(NO_RETRAIN_VARIANTS))
        for name, p in probs.items():
            self.assertEqual(len(p), len(self.part), name)
            self.assertTrue(((p >= 0) & (p <= 1)).all(), name)

    def test_blend_is_the_mean_of_its_parts(self):
        probs = variant_probabilities(self.trailing, self.part)
        np.testing.assert_allclose(probs[BLEND], (probs[LSTM_CALIBRATED] + probs["Recent volatility, platform fit"]) / 2)

    def test_calibration_keeps_the_ranking(self):
        probs = variant_probabilities(self.trailing, self.part)
        order_raw = np.argsort(probs["LSTM as trained"])
        order_cal = np.argsort(probs[LSTM_CALIBRATED])
        np.testing.assert_array_equal(order_raw, order_cal)

    def test_one_class_trailing_falls_back_to_a_constant(self):
        calm = self.trailing.assign(big=False)  # nothing was a big move
        probs = variant_probabilities(calm, self.part)
        self.assertTrue((probs[LSTM_CALIBRATED] == 0.0).all())


class MonthlyRowTests(unittest.TestCase):
    def test_first_months_are_skipped_until_enough_days_came_before(self):
        rows = monthly_rows(fake_daily(), "AAPL", min_days=40)
        first = rows["day"].min()
        self.assertGreaterEqual((fake_daily().index < first).sum(), 40)
        self.assertEqual(set(rows["variant"]), set(NO_RETRAIN_VARIANTS))

    def test_cut_off_is_the_median_of_the_40_days_before_each_day(self):
        daily = fake_daily()
        rows = monthly_rows(daily, "AAPL", min_days=40)
        first = rows["day"].min()
        position = daily.index.get_loc(first)
        expected = float(daily["move"].iloc[position - 40 : position].median())
        self.assertAlmostEqual(rows["threshold"].iloc[0], expected)
        # Scored days are labelled against their own cut-off, so about half are big moves.
        share = rows[rows["variant"] == ONE_ANSWER]["actual"].mean()
        self.assertTrue(0.35 < share < 0.65, share)

    def test_changing_a_later_month_leaves_earlier_rows_alone(self):
        daily = fake_daily()
        before = monthly_rows(daily, "AAPL", min_days=40)
        changed = daily.copy()
        changed.loc[changed.index >= "2026-08-01", "move"] *= 5
        after = monthly_rows(changed, "AAPL", min_days=40)
        early = before["day"] < pd.Timestamp("2026-08-01")
        pd.testing.assert_frame_equal(before[early].reset_index(drop=True), after[early].reset_index(drop=True))

    def test_extra_variant_is_scored_only_on_months_it_covers_in_full(self):
        daily = fake_daily()
        series = pd.Series(0.7, index=daily.index[daily.index >= "2026-07-01"])
        rows = monthly_rows(daily, "AAPL", min_days=40, extra={PLATFORM_LSTM: series})
        lstm = rows[rows["variant"] == PLATFORM_LSTM]
        self.assertTrue((lstm["day"] >= pd.Timestamp("2026-07-01")).all())
        self.assertEqual(lstm["day"].nunique(), len(series))


class SummaryTests(unittest.TestCase):
    def test_usable_means_beating_one_answer_with_positive_skill(self):
        rows = pd.DataFrame([
            *({"symbol": "A", "month": "2026-06", "variant": "good", "day": i, "prob": 0.9 if i % 2 else 0.1,
               "actual": bool(i % 2), "base_rate": 0.5, "threshold": 0.01} for i in range(20)),
            *({"symbol": "A", "month": "2026-06", "variant": ONE_ANSWER, "day": i, "prob": 1.0,
               "actual": bool(i % 2), "base_rate": 0.5, "threshold": 0.01} for i in range(20)),
        ])
        table = summarise(rows).set_index("variant")
        self.assertTrue(table.loc["good", "usable"])
        self.assertFalse(table.loc[ONE_ANSWER, "usable"])
        self.assertEqual(table.loc["good", "rule_accuracy"], 0.5)

    def test_months_filter_limits_every_variant_to_the_same_days(self):
        rows = monthly_rows(fake_daily(), "AAPL", min_days=40)
        table = summarise(rows, months=["2026-08"])
        self.assertTrue((table["months"] == 1).all())

    def test_chart_is_written(self):
        table = summarise(monthly_rows(fake_daily(), "AAPL", min_days=40))
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(plot_platform_calibration(table, f"{folder}/c.png", "t", ONE_ANSWER).exists())


class PlatformScoreTests(unittest.TestCase):
    def test_features_come_from_the_close_before_each_forecast_day(self):
        index = pd.bdate_range("2026-01-02", periods=80)
        data = pd.DataFrame({"abs_ret": np.arange(80, dtype=float), f"volatility_{config.VOLATILITY_WINDOW}": 1.0,
                             "target": 0.01}, index=index)
        lookback = 60
        fake = pd.DataFrame({"prob_big": 0.3, "move": 0.01, "big": False}, index=index[lookback:])
        with mock.patch("stock_forecast.platform_calibration.daily_big_move_probability", return_value=fake):
            scores = platform_scores(data)
        # The forecast for day t was made at day t - 1, so it carries day t - 1's features.
        np.testing.assert_array_equal(scores["abs_ret"].to_numpy(), np.arange(lookback - 1, 79, dtype=float))


if __name__ == "__main__":
    unittest.main()
