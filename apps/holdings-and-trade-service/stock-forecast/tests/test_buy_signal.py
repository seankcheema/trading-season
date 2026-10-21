"""Buy signal tests: what a flagged day means, how a cutoff is chosen, and no peeking at the scored year."""
import math
import unittest

import numpy as np

from stock_forecast.buy_signal import (INDICATOR_MODEL, buy_signal_fold, choose_cutoff, signal_metrics,
                                       validation_cutoffs)
from stock_forecast.data import add_indicators, split_by_date
from stock_forecast.walk_forward import walk_forward_folds
from tests.helpers import make_dataset


class SignalMetricTests(unittest.TestCase):
    def test_edge_is_flagged_up_rate_minus_every_day(self):
        actual = np.array([0.01, 0.02, -0.01, -0.02])
        m = signal_metrics(actual, np.array([0.7, 0.6, 0.4, 0.3]), cutoff=0.6)
        self.assertEqual(m["signals"], 2)
        self.assertEqual(m["signal_rate"], 0.5)
        self.assertEqual(m["hit_rate"], 1.0)
        self.assertEqual(m["up_rate"], 0.5)
        self.assertEqual(m["edge"], 0.5)
        self.assertAlmostEqual(m["signal_mean_return"], 0.015)

    def test_no_cutoff_flags_nothing(self):
        m = signal_metrics(np.array([0.01, -0.01]), np.array([0.9, 0.9]), cutoff=None)
        self.assertEqual(m["signals"], 0)
        self.assertTrue(math.isnan(m["edge"]))

    def test_shape_mismatch_is_rejected(self):
        with self.assertRaises(ValueError):
            signal_metrics(np.zeros(3), np.zeros(2), 0.5)


class ChooseCutoffTests(unittest.TestCase):
    def test_picks_the_cutoff_with_the_largest_edge(self):
        # Only days with P(up) >= 0.6 go up, so 0.6 flags exactly the up days.
        prob = np.array([0.55] * 10 + [0.65] * 10)
        actual = np.array([-0.01] * 10 + [0.01] * 10)
        self.assertEqual(choose_cutoff(actual, prob, cutoffs=[0.5, 0.6, 0.7], min_signals=5), 0.6)

    def test_too_few_flagged_days_are_ignored(self):
        prob = np.array([0.55] * 10 + [0.65] * 3)
        actual = np.array([-0.01] * 10 + [0.01] * 3)
        self.assertIsNone(choose_cutoff(actual, prob, cutoffs=[0.6], min_signals=5))

    def test_none_when_no_cutoff_beats_buying_every_day(self):
        prob = np.array([0.55] * 10 + [0.65] * 10)
        actual = np.array([0.01] * 10 + [-0.01] * 10)
        self.assertIsNone(choose_cutoff(actual, prob, cutoffs=[0.5, 0.6], min_signals=5))


class BuySignalFoldTests(unittest.TestCase):
    def setUp(self):
        self.fold = walk_forward_folds(add_indicators(make_dataset()), years=[2020])[0]

    def test_scores_the_test_year_with_a_cutoff_from_the_year_before(self):
        [row] = buy_signal_fold(self.fold, with_lstm=False)
        self.assertEqual(row["model"], INDICATOR_MODEL)
        self.assertEqual(row["days"], len(self.fold.test))

    def test_cutoff_never_reads_the_scored_year_labels(self):
        [before] = buy_signal_fold(self.fold, with_lstm=False)
        test = self.fold.test.copy()
        test["target"] = -test["target"]
        [after] = buy_signal_fold(type(self.fold)(self.fold.year, self.fold.train, self.fold.val, test),
                                  with_lstm=False)
        self.assertEqual(before["cutoff"], after["cutoff"])
        np.testing.assert_equal(before["chosen_edge"], after["chosen_edge"])  # NaN-safe when no cutoff wins

    def test_validation_cutoffs_leave_out_the_last_label(self):
        splits = split_by_date(add_indicators(make_dataset()))
        [row] = validation_cutoffs(splits.train, splits.val, with_lstm=False)
        self.assertEqual(row["days"], len(splits.val) - 1)


if __name__ == "__main__":
    unittest.main()
