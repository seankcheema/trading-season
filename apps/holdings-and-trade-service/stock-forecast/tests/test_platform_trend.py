"""Platform trend tests: the label looks ahead, the fits do not, and the file keeps its contract."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from stock_forecast.platform_trend import (TREND_FIELDS, build_trend, monthly_signal_cutoffs,
                                           monthly_trend_probabilities, signal_cutoff, summarise_trend, trend_daily,
                                           trend_days, validate_trend, write_trend)
from tests.helpers import make_prices
from tests.test_platform_horizon import platform_like

H = 5


def platform_close() -> pd.Series:
    return make_prices(0, start="2025-06-01", end="2026-12-31")["Close"]


def fake_probabilities(daily: pd.DataFrame, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    index = daily.index[daily.index >= "2026-07-01"]
    return pd.Series(rng.uniform(0.1, 0.9, len(index)), index=index)


class LabelTests(unittest.TestCase):
    def setUp(self):
        self.data = platform_like()
        self.close = platform_close()
        self.daily = trend_daily(self.data, self.close, H)

    def test_label_is_the_next_days_return_and_inputs_are_known_at_the_close(self):
        day = self.daily.index[100]
        pos = self.close.index.get_loc(day)
        expected = np.log(self.close.iloc[pos + H] / self.close.iloc[pos])
        self.assertAlmostEqual(self.daily.loc[day, "target"], expected)
        self.assertAlmostEqual(self.daily.loc[day, "momentum"], np.log(self.close.iloc[pos] / self.close.iloc[pos - 10]))
        self.assertEqual(self.daily.loc[day, "up"], expected > 0)
        self.assertTrue(self.daily["target"].iloc[-H:].isna().all())
        self.assertTrue(self.daily["target"].iloc[:-H].notna().all())

    def test_bad_horizons_are_rejected(self):
        with self.assertRaises(ValueError):
            trend_daily(self.data, self.close, 0)


class WalkForwardTests(unittest.TestCase):
    def test_each_month_is_fit_on_closed_days_before_it_only(self):
        daily = trend_daily(platform_like(), platform_close(), H)
        fits = []

        class Recorder:
            def fit(self, X, y):
                fits.append(len(X))
                return self

            def predict_proba(self, X):
                return np.tile([0.4, 0.6], (len(X), 1))

        seen_rows = []

        class Probe(Recorder):
            def fit(self, X, y):
                seen_rows.append(X[:, 0].copy())
                return super().fit(X, y)

        probs = monthly_trend_probabilities({"AAPL": daily, "MSFT": daily}, H, first_month="2026-07", make_model=Probe)
        self.assertEqual(len(fits), 6)  # July to December
        self.assertTrue(all(b > a for a, b in zip(fits, fits[1:])))  # each month sees more days
        self.assertEqual(probs["AAPL"].index.min().strftime("%Y-%m"), "2026-07")
        self.assertEqual(probs["AAPL"].index.max().strftime("%Y-%m"), "2026-12")
        # The July fit's rows are the momentum values of days whose window closed before July minus the purge.
        july_start = pd.Timestamp("2026-07-01")
        allowed = daily[(daily.index < july_start) & daily["target"].notna()].iloc[:-H]["momentum"].to_numpy()
        self.assertEqual(len(seen_rows[0]), 2 * len(allowed))
        np.testing.assert_allclose(np.sort(seen_rows[0]), np.sort(np.concatenate([allowed, allowed])))
        np.testing.assert_allclose(probs["AAPL"].to_numpy(), 0.6)

    def test_months_without_enough_history_are_not_scored(self):
        daily = trend_daily(platform_like(), platform_close(), H).loc["2026-06-01":]
        probs = monthly_trend_probabilities({"AAPL": daily}, H, first_month="2026-07")
        self.assertTrue(probs["AAPL"].empty or probs["AAPL"].index.min() > pd.Timestamp("2026-07-31"))


class RecordTests(unittest.TestCase):
    def setUp(self):
        self.daily = trend_daily(platform_like(), platform_close(), H)
        self.prob = fake_probabilities(self.daily)
        self.days = trend_days(self.daily, self.prob, H)

    def test_one_record_per_scored_day_with_the_contract_fields(self):
        self.assertEqual(len(self.days), len(self.prob))
        self.assertTrue(all(tuple(d) == TREND_FIELDS for d in self.days))
        self.assertEqual(self.days[0]["modelDays"], 0)

    def test_counts_cover_only_windows_closed_by_that_day(self):
        for i, d in enumerate(self.days[:30]):
            self.assertEqual(d["modelDays"], max(0, i - H + 1))
            self.assertEqual(d["ruleDays"], d["modelDays"])
        scored = self.daily.loc[self.prob.index]
        first_closed = scored.iloc[0]
        expected_hit = int((self.prob.iloc[0] > 0.5) == first_closed["up"])
        self.assertEqual(self.days[H]["modelHits"], expected_hit)
        self.assertEqual(self.days[H]["ruleHits"], int((first_closed["momentum"] > 0) == first_closed["up"]))

    def test_the_last_days_have_no_outcome_or_move_yet(self):
        self.assertTrue(all(d["outcome"] is None and d["move"] is None for d in self.days[-H:]))
        self.assertTrue(all(d["outcome"] in ("up", "down") and d["move"] is not None for d in self.days[:-H]))

    def test_records_do_not_change_when_later_prices_change(self):
        cut = self.daily.index[-40]
        before = trend_days(self.daily.loc[:cut], self.prob.loc[:cut], H)
        self.assertEqual(before[:-H], self.days[: len(before) - H])


class StrongTrendTests(unittest.TestCase):
    def setUp(self):
        self.daily = trend_daily(platform_like(), platform_close(), H)

    def test_strength_is_the_last_days_move_against_its_noise(self):
        from stock_forecast import config
        data, close = platform_like(), platform_close()
        day = self.daily.index[60]
        pos = close.index.get_loc(day)
        move = np.log(close.iloc[pos] / close.iloc[pos - config.PLATFORM_TREND_SIGNAL_DAYS])
        noise = data.loc[day, "volatility_10"] * np.sqrt(config.PLATFORM_TREND_SIGNAL_DAYS)
        self.assertAlmostEqual(self.daily.loc[day, "strength"], abs(move) / noise)

    def test_cutoff_is_the_lowest_that_reaches_the_target(self):
        # Strong days are always right, weak days always wrong: the cut-off must drop the weak ones only.
        fit = pd.DataFrame({"strength": np.r_[np.linspace(0, 0.9, 40), np.linspace(1, 2, 60)],
                            "signal_momentum": 1.0, "up": np.r_[np.zeros(40, bool), np.ones(60, bool)]})
        exact = signal_cutoff(fit, target=1.0, min_share=0.3)
        self.assertTrue(0.9 < exact <= 1.0)  # every weak day out, every strong day in
        # A looser target lets a few weak days back in, so its cut-off is lower.
        self.assertLess(signal_cutoff(fit, target=0.95, min_share=0.3), exact)

    def test_no_cutoff_when_the_target_needs_too_few_calls(self):
        fit = pd.DataFrame({"strength": np.linspace(0, 1, 100), "signal_momentum": 1.0,
                            "up": np.r_[np.zeros(90, bool), np.ones(10, bool)]})
        self.assertIsNone(signal_cutoff(fit, target=0.85, min_share=0.3))
        self.assertIsNone(signal_cutoff(fit.iloc[:0]))

    def test_each_month_cutoff_ignores_later_days(self):
        cutoffs = monthly_signal_cutoffs({"AAPL": self.daily}, H, "2026-07")
        changed = self.daily.copy()
        later = changed.index >= "2026-09-01"
        changed.loc[later, "up"] = ~changed.loc[later, "up"]
        again = monthly_signal_cutoffs({"AAPL": changed}, H, "2026-07")
        self.assertEqual(sorted(cutoffs), [f"2026-{m:02d}" for m in range(7, 13)])
        for month in ("2026-07", "2026-08"):
            self.assertEqual(cutoffs[month], again[month])

    def test_calls_and_counts_follow_the_month_cutoff(self):
        prob = fake_probabilities(self.daily)
        months = sorted({str(m) for m in prob.index.to_period("M")})
        days = trend_days(self.daily, prob, H, {m: 1.0 for m in months})
        none = trend_days(self.daily, prob, H)
        scored = self.daily.loc[prob.index]
        for d, (_, row) in zip(days, scored.iterrows()):
            self.assertEqual(d["signal"] is not None, row["strength"] >= 1.0)
            if d["signal"] is not None:
                self.assertEqual(d["signal"], "up" if row["signal_momentum"] > 0 else "down")
        self.assertTrue(all(d["signal"] is None and d["signalDays"] == 0 for d in none))
        last = days[-1]
        closed = scored.iloc[: len(scored) - H]
        called = closed[closed["strength"] >= 1.0]
        self.assertEqual(last["signalDays"], len(called))
        self.assertEqual(last["signalHits"], int(((called["signal_momentum"] > 0) == called["up"]).sum()))


class DocumentTests(unittest.TestCase):
    def setUp(self):
        daily = trend_daily(platform_like(), platform_close(), H)
        self.dailies = {"AAPL": daily, "MSFT": daily}
        self.probs = {"AAPL": fake_probabilities(daily, 0), "MSFT": fake_probabilities(daily, 1)}
        self.document = build_trend(self.dailies, self.probs, H, datetime(2026, 10, 21, tzinfo=timezone.utc))

    def test_document_validates_round_trips_and_carries_the_notice(self):
        validate_trend(self.document)
        self.assertIn("must not be taken as true", self.document["notice"])
        with tempfile.TemporaryDirectory() as folder:
            path = write_trend(self.document, Path(folder) / "trend.json")
            validate_trend(json.loads(path.read_text()))

    def test_missing_probabilities_are_an_error(self):
        with self.assertRaises(ValueError):
            build_trend(self.dailies, {"AAPL": self.probs["AAPL"]}, H)

    def test_contract_breaches_are_rejected(self):
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][0]["call"] = "sideways"
        with self.assertRaises(ValueError):
            validate_trend(broken)
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][0]["move"] = None
        with self.assertRaises(ValueError):
            validate_trend(broken)
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][0]["signal"] = "sideways"
        with self.assertRaises(ValueError):
            validate_trend(broken)
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][-1]["signalDays"] = broken["symbols"]["AAPL"]["days"][-1]["modelDays"] + 1
        with self.assertRaises(ValueError):
            validate_trend(broken)
        broken = json.loads(json.dumps(self.document))
        del broken["notice"]
        with self.assertRaises(ValueError):
            validate_trend(broken)

    def test_summary_reads_the_final_record_and_the_moves_after_each_call(self):
        table = summarise_trend(self.document).set_index("symbol")
        last = self.document["symbols"]["AAPL"]["days"][-1]
        self.assertAlmostEqual(table.loc["AAPL", "model_accuracy"], last["modelHits"] / last["modelDays"])
        self.assertTrue(np.isfinite(table.loc["AAPL", "mean_move_after_up_call"]))


if __name__ == "__main__":
    unittest.main()
