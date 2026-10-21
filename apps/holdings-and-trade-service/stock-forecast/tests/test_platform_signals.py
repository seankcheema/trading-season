"""Platform signal tests: the file's contract, and a track record that never reads the future."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from stock_forecast.platform_horizon import horizon_daily
from stock_forecast.platform_signals import (DAY_FIELDS, build_signals, monthly_platform_probabilities,
                                             summarise_signals, symbol_days, validate_signals, write_signals)
from tests.test_platform_horizon import platform_like

H = 5


def fake_probabilities(daily: pd.DataFrame, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    index = daily.index[daily.index >= "2026-07-01"]
    return pd.Series(rng.uniform(0.1, 0.9, len(index)), index=index)


class SymbolDayTests(unittest.TestCase):
    def setUp(self):
        self.daily = horizon_daily(platform_like(), H)
        self.prob = fake_probabilities(self.daily)
        self.days = symbol_days(self.daily, self.prob, H)

    def test_one_record_per_scored_day_with_the_contract_fields(self):
        self.assertEqual(len(self.days), len(self.prob))
        self.assertEqual(tuple(self.days[0]), DAY_FIELDS)
        self.assertEqual(self.days[0]["date"], "2026-07-01")

    def test_track_record_counts_only_windows_closed_by_that_day(self):
        # On day i the record covers days 0 .. i - H; day H's record is the first with one closed window.
        self.assertEqual(self.days[H - 1]["modelDays"], 0)
        self.assertEqual(self.days[H]["modelDays"], 1)
        hit = self.days[0]["call"] == self.days[0]["outcome"]
        self.assertEqual(self.days[H]["modelHits"], int(hit))

    def test_the_last_days_have_no_outcome_yet(self):
        self.assertIsNone(self.days[-1]["outcome"])
        self.assertIsNotNone(self.days[-H - 1]["outcome"])

    def test_records_do_not_change_when_later_prices_change(self):
        later = self.daily.copy()
        cut = later.index[-30]
        later.loc[later.index >= cut, ["target", "big"]] = [0.5, True]
        changed = symbol_days(later, self.prob, H)
        unaffected = [d for d in self.days if pd.Timestamp(d["date"]) < cut - pd.Timedelta(days=1)]
        for before, after in zip(unaffected, changed):
            self.assertEqual(before, after)


class DocumentTests(unittest.TestCase):
    def setUp(self):
        data = platform_like()
        self.datasets = {"AAPL": data, "MSFT": data}
        daily = horizon_daily(data, H)
        self.probs = {"AAPL": fake_probabilities(daily, 0), "MSFT": fake_probabilities(daily, 1)}
        self.document = build_signals(self.datasets, self.probs, H, datetime(2026, 10, 21, tzinfo=timezone.utc))

    def test_document_validates_and_round_trips(self):
        validate_signals(self.document)
        with tempfile.TemporaryDirectory() as folder:
            path = write_signals(self.document, Path(folder) / "platform-signals.json")
            self.assertEqual(json.loads(path.read_text()), self.document)

    def test_missing_symbol_probabilities_are_an_error(self):
        with self.assertRaises(ValueError):
            build_signals(self.datasets, {"AAPL": self.probs["AAPL"]}, H)

    def test_contract_breaches_are_rejected(self):
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][0]["probability"] = 1.5
        with self.assertRaises(ValueError):
            validate_signals(broken)
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"][0]["extra"] = 1
        with self.assertRaises(ValueError):
            validate_signals(broken)
        broken = json.loads(json.dumps(self.document))
        broken["symbols"]["AAPL"]["days"].reverse()
        with self.assertRaises(ValueError):
            validate_signals(broken)

    def test_summary_reads_the_final_record(self):
        table = summarise_signals(self.document).set_index("symbol")
        last = self.document["symbols"]["AAPL"]["days"][-1]
        self.assertEqual(table.loc["AAPL", "days_scored"], last["modelDays"])
        self.assertAlmostEqual(table.loc["AAPL", "model_accuracy"], last["modelHits"] / last["modelDays"])




class MonthlyRetrainingTests(unittest.TestCase):
    def test_each_month_is_scored_by_a_model_that_stopped_on_the_month_before(self):
        data = platform_like()
        calls = []

        def fake_trainer(datasets, horizon, train_end, val_end, verbose):
            calls.append((train_end, val_end))
            return {symbol: pd.Series(0.5, index=d.loc[val_end:].index[1:]) for symbol, d in datasets.items()}

        probs = monthly_platform_probabilities({"AAPL": data, "MSFT": data}, H, first_month="2026-07",
                                               trainer=fake_trainer)
        self.assertEqual(calls[0], ("2026-05-31", "2026-06-30"))
        self.assertEqual(calls[1], ("2026-06-30", "2026-07-31"))
        self.assertEqual(len(calls), 6)  # July to December
        series = probs["AAPL"]
        self.assertEqual(series.index.min().strftime("%Y-%m"), "2026-07")
        self.assertEqual(series.index.max().strftime("%Y-%m"), "2026-12")
        self.assertTrue(series.index.is_monotonic_increasing and series.index.is_unique)


if __name__ == "__main__":
    unittest.main()
