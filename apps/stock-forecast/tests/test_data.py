import tempfile
import unittest
from pathlib import Path

import numpy as np

from stock_forecast.data import add_features, build_dataset, load_prices, save_prices, split_by_date
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
        dataset = make_dataset()
        splits = split_by_date(dataset)
        self.assertLess(splits.train.index.max(), splits.val.index.min())
        self.assertLess(splits.val.index.max(), splits.test.index.min())
        self.assertEqual(len(splits.train) + len(splits.val) + len(splits.test), len(dataset))
        self.assertEqual(splits.val.index.min().year, 2022)
        self.assertEqual(splits.test.index.min().year, 2024)

    def test_empty_split_is_rejected(self):
        with self.assertRaises(ValueError):
            split_by_date(make_dataset(), test_start="2030-01-01")


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


if __name__ == "__main__":
    unittest.main()
