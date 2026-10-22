"""Platform trend tests: the label looks ahead, the fits do not, and the file keeps its contract."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from stock_forecast.platform_trend import (TREND_FIELDS, build_trend, monthly_trend_probabilities, summarise_trend,
                                           trend_daily, trend_days, validate_trend, write_trend)
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
