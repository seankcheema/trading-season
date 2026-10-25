import subprocess
import sys
import unittest

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.week_ahead import MODEL, RULE, most_confident, past_volatility, score_period


def frame(n: int = 900, seed: int = 0) -> pd.DataFrame:
    """Rows with the horizon study's columns: persistent volatility, so both the model and the rule have work."""
    rng = np.random.default_rng(seed)
    index = pd.bdate_range("2015-01-01", periods=n, name="Date")
    vol = 0.01 * np.exp(np.cumsum(rng.normal(0, 0.05, n)))
    ret = pd.Series(rng.normal(0, 1, n) * vol, index=index)
    data = pd.DataFrame({c: rng.normal(0, 1, n) for c in config.HORIZON_FEATURES}, index=index)
    data["ret"] = ret
    data["volatility_10"] = ret.pow(2).rolling(10, min_periods=1).mean().pow(0.5)
    data["target"] = ret.pow(2)[::-1].rolling(5).mean()[::-1].shift(-1).pow(0.5)
    data["past_vol"] = past_volatility(ret, 5)
    return data.dropna(subset=["target", "past_vol"])


class PastVolatilityTests(unittest.TestCase):
    def test_is_the_root_mean_square_of_the_last_days_including_today(self):
        r = pd.Series([0.01, -0.02, 0.03, 0.0])
        out = past_volatility(r, 2)
        self.assertTrue(np.isnan(out.iloc[0]))
        self.assertAlmostEqual(out.iloc[2], np.sqrt((0.02 ** 2 + 0.03 ** 2) / 2))

    def test_tomorrow_never_enters_today(self):
        r = pd.Series([0.0, 0.0, 0.5])
        self.assertEqual(past_volatility(r, 2).iloc[1], 0.0)

    def test_bad_window_is_rejected(self):
        with self.assertRaises(ValueError):
            past_volatility(pd.Series([0.01]), 0)


class ScorePeriodTests(unittest.TestCase):
    def setUp(self):
        self.data = frame()
        self.train, self.val, self.scored = self.data.iloc[:500], self.data.iloc[500:700], self.data.iloc[700:]

    def test_threshold_comes_from_training_labels_before_the_purge(self):
        rows, _, _ = score_period("SPY", self.train, self.val, self.scored, 5, "test")
        expected = float(self.train.iloc[:-5]["target"].median())
        self.assertTrue(all(r["threshold"] == expected for r in rows))

    def test_scores_the_model_and_the_rule_on_the_same_days(self):
        rows, prob, actual = score_period("SPY", self.train, self.val, self.scored, 5, "test")
        self.assertEqual([r["model"] for r in rows], [MODEL, RULE])
        self.assertTrue(all(r["days"] == len(self.scored) == len(prob) == len(actual) for r in rows))
        rule = rows[1]
        self.assertAlmostEqual(rule["accuracy"], rule["rule_accuracy"])
        self.assertAlmostEqual(rule["one_answer_bar"], max(actual.mean(), 1 - actual.mean()))

    def test_scored_labels_do_not_change_the_fit(self):
        _, prob, _ = score_period("SPY", self.train, self.val, self.scored, 5, "test")
        changed = self.scored.copy()
        changed["target"] = changed["target"][::-1].to_numpy()
        _, again, _ = score_period("SPY", self.train, self.val, changed, 5, "test")
        np.testing.assert_allclose(prob, again)

    def test_rule_needs_a_complete_window_on_every_scored_day(self):
        scored = self.scored.copy()
        scored.iloc[0, scored.columns.get_loc("past_vol")] = np.nan
        with self.assertRaises(ValueError):
            score_period("SPY", self.train, self.val, scored, 5, "test")

    def test_too_short_a_period_is_rejected(self):
        with self.assertRaises(ValueError):
            score_period("SPY", self.train, self.val.iloc[:5], self.scored, 5, "test")


class MostConfidentTests(unittest.TestCase):
    def test_weights_the_top_buckets_by_their_days(self):
        buckets = pd.DataFrame({"days": [10, 10, 20], "accuracy": [0.5, 0.6, 0.9]})
        accuracy, share = most_confident(buckets, 2)
        self.assertAlmostEqual(accuracy, (0.6 * 10 + 0.9 * 20) / 30)
        self.assertAlmostEqual(share, 0.75)

    def test_rejects_a_count_outside_the_buckets(self):
        with self.assertRaises(ValueError):
            most_confident(pd.DataFrame({"days": [1], "accuracy": [1.0]}), 2)


class TestRunGuardTests(unittest.TestCase):
    def test_refuses_to_score_the_test_years_without_a_committed_preregistration(self):
        if config.TEST_WEEK_AHEAD_CSV.exists():
            self.skipTest("the test has run; the run-once guard answers first")
        prereg = config.WEEK_AHEAD_PREREGISTRATION.name
        try:
            status = subprocess.run(["git", "status", "--porcelain", "--", prereg], cwd=config.ROOT,
                                    capture_output=True, text=True)
            committed = subprocess.run(["git", "log", "-1", "--format=%h", "--", prereg], cwd=config.ROOT,
                                       capture_output=True, text=True)
        except FileNotFoundError:
            self.skipTest("git is not installed")
        if status.returncode or (committed.stdout.strip() and not status.stdout.strip()):
            self.skipTest("no git, or the pre-registration is committed; running would score the test years")
        result = subprocess.run([sys.executable, str(config.ROOT / "scripts" / "0006-test-week-ahead-risk.py")],
                                cwd=config.ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("before running the test", result.stderr)
        self.assertFalse(config.TEST_WEEK_AHEAD_CSV.exists())
