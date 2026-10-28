import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import numpy as np
import pandas as pd

from stock_forecast.data import (add_features, build_dataset, download_earnings_dates, download_prices, load_prices,
                                 save_prices, split_by_date)
from stock_forecast import config
from tests.helpers import make_dataset, make_prices


class AddFeaturesTests(unittest.TestCase):
    # Pin the meaning and timing of each engineered feature and target.
    def test_target_is_the_next_days_return(self):
        features = add_features(make_prices())
        self.assertAlmostEqual(features["target"].iloc[10], features["ret"].iloc[11])
        self.assertTrue(np.isnan(features["target"].iloc[-1]))

    def test_return_is_the_percent_change_in_close(self):
        prices = make_prices()
        features = add_features(prices)
        expected = prices["Close"].iloc[5] / prices["Close"].iloc[4] - 1
        self.assertAlmostEqual(features["ret"].iloc[5], expected)

    def test_zero_volume_does_not_produce_infinity(self):
        prices = make_prices()
        prices.iloc[20, prices.columns.get_loc("Volume")] = 0
        features = add_features(prices)
        self.assertFalse(np.isinf(features["volume_change"]).any())


class BuildDatasetTests(unittest.TestCase):
    def test_has_expected_columns_and_no_missing_values(self):
        dataset = make_dataset()
        self.assertEqual(list(dataset.columns), ["close", "ret", "spy_ret", "volume_change", "target"])
        self.assertFalse(dataset.isna().any().any())

    def test_market_return_is_aligned_by_date_not_position(self):
        prices, market = make_prices(0), make_prices(1, start_price=300.0)
        dropped = market.index[100]
        dataset = build_dataset(prices, market.drop(index=dropped))
        self.assertNotIn(dropped, dataset.index)
        day = market.index[50]
        expected = market["Close"].loc[day] / market["Close"].iloc[49] - 1
        self.assertAlmostEqual(dataset.loc[day, "spy_ret"], expected)


class SplitByDateTests(unittest.TestCase):
    # Split boundaries are part of the experiment, not random sampling choices.
    def test_splits_are_in_order_and_cover_every_row(self):
        dataset = make_dataset(start="2010-01-01")
        splits = split_by_date(dataset)
        self.assertLess(splits.train.index.max(), splits.val.index.min())
        self.assertLess(splits.val.index.max(), splits.test.index.min())
        self.assertEqual(len(splits.train) + len(splits.val) + len(splits.test), len(dataset))
        self.assertEqual(splits.train.index.min().year, 2010)
        self.assertEqual(splits.train.index.max().date().isoformat(), config.TRAIN_END)
        self.assertEqual(splits.val.index.min().year, 2022)
        self.assertEqual(splits.val.index.max().year, 2023)
        self.assertEqual(splits.test.index.min().year, 2024)
        for part in (splits.train, splits.val, splits.test):
            self.assertFalse(part.isna().any().any())
            self.assertTrue(part.index.is_monotonic_increasing)

    def test_empty_split_is_rejected(self):
        dataset = make_dataset()
        empty_ranges = (
            {"train_end": "2000-12-31"},
            {"val_start": "2030-01-01", "val_end": "2030-12-31", "test_start": "2031-01-01"},
            {"test_start": "2030-01-01"},
        )
        for boundaries in empty_ranges:
            with self.subTest(boundaries=boundaries), self.assertRaises(ValueError):
                split_by_date(dataset, **boundaries)

    def test_overlapping_split_boundaries_are_rejected(self):
        with self.assertRaises(ValueError):
            split_by_date(make_dataset(), train_end="2022-06-30")

    def test_out_of_order_split_boundaries_are_rejected(self):
        with self.assertRaises(ValueError):
            split_by_date(make_dataset(), val_start="2023-01-01", val_end="2022-12-31")

    def test_unsorted_or_missing_dataset_is_rejected_without_shuffling(self):
        dataset = make_dataset()
        with self.assertRaises(ValueError):
            split_by_date(dataset.iloc[::-1])
        dataset.iloc[100, dataset.columns.get_loc("close")] = np.nan
        with self.assertRaises(ValueError):
            split_by_date(dataset)

    def test_duplicate_dates_are_rejected(self):
        dataset = make_dataset()
        with self.assertRaises(ValueError):
            split_by_date(pd.concat([dataset.iloc[:1], dataset]))


class SaveLoadTests(unittest.TestCase):
    # Snapshot checks protect reproducibility and reject accidental replacement.
    def test_round_trip_keeps_prices(self):
        prices = make_prices()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "prices.csv"
            save_prices(prices, path)
            loaded = load_prices(path)
        np.testing.assert_allclose(loaded["Close"].to_numpy(), prices["Close"].to_numpy())
        self.assertEqual(list(loaded.index), list(prices.index))

    def test_save_refuses_to_overwrite_a_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "prices.csv"
            save_prices(make_prices(), path)
            with self.assertRaises(FileExistsError):
                save_prices(make_prices(), path)

    def test_load_rejects_missing_columns(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "prices.csv"
            make_prices().drop(columns=["Volume"]).to_csv(path)
            with self.assertRaises(ValueError):
                load_prices(path)

    def test_load_rejects_repeated_dates_and_missing_closes(self):
        prices = make_prices()
        missing_close = prices.copy()
        missing_close.iloc[5, missing_close.columns.get_loc("Close")] = np.nan
        for name, broken in (("repeated", pd.concat([prices.iloc[:1], prices])), ("no close", missing_close)):
            with self.subTest(name), tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "prices.csv"
                broken.to_csv(path)
                with self.assertRaises(ValueError):
                    load_prices(path)


def fake_yfinance(prices=None, events=None):
    """A stand-in for the yfinance module, so the download checks run offline."""
    ticker = SimpleNamespace(get_earnings_dates=lambda limit: events)
    return SimpleNamespace(download=lambda *args, **kwargs: prices, Ticker=lambda symbol: ticker)


class DownloadTests(unittest.TestCase):
    # A failed download must stop the pipeline, never hand back partial or invented data.
    def download(self, prices):
        with mock.patch.dict("sys.modules", {"yfinance": fake_yfinance(prices=prices)}):
            return download_prices("AAPL")

    def test_keeps_the_required_columns_with_a_date_index(self):
        prices = make_prices().assign(Extra=1.0)
        prices.index.name = None
        frame = self.download(prices)
        self.assertEqual(list(frame.columns), ["Open", "High", "Low", "Close", "Volume"])
        self.assertEqual(frame.index.name, "Date")

    def test_empty_or_incomplete_downloads_raise(self):
        for name, prices in (("nothing", None), ("empty", pd.DataFrame()),
                             ("no volume", make_prices().drop(columns=["Volume"]))):
            with self.subTest(name), self.assertRaises(RuntimeError):
                self.download(prices)

    def test_earnings_keep_only_the_announcement_times_oldest_first(self):
        stamps = pd.DatetimeIndex(["2024-05-02 16:30", "2024-02-01 16:30"], tz="America/New_York")
        events = pd.DataFrame({"Reported EPS": [1.5, 2.1]}, index=stamps)
        with mock.patch.dict("sys.modules", {"yfinance": fake_yfinance(events=events)}):
            frame = download_earnings_dates("AAPL")
        self.assertEqual(list(frame.columns), ["announced_at"])
        self.assertEqual(list(frame["announced_at"]), sorted(stamps))

    def test_no_earnings_dates_raise(self):
        for events in (None, pd.DataFrame()):
            with mock.patch.dict("sys.modules", {"yfinance": fake_yfinance(events=events)}), \
                    self.assertRaises(RuntimeError):
                download_earnings_dates("AAPL")


if __name__ == "__main__":
    unittest.main()
