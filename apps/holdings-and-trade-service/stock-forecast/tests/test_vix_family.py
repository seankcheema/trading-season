import unittest

import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.data import add_earnings, add_indicators, add_vix, add_vix_family, add_vix_gap
from tests.helpers import make_dataset, make_prices


def family(drop_day=None):
    frames = [make_prices(s, start_price=p) for s, p in ((11, 18.0), (12, 22.0), (13, 90.0))]
    if drop_day is not None:
        frames[0] = frames[0].drop(drop_day)
    return frames


class VixFamilyTests(unittest.TestCase):
    def setUp(self):
        self.base = add_vix(add_indicators(make_dataset()), make_prices(5, start_price=20.0))

    def test_ratios_and_vvix_are_same_day_values(self):
        vix9d, vix3m, vvix = family()
        joined = add_vix_family(self.base, vix9d, vix3m, vvix)
        day = joined.index[40]
        vix = self.base.loc[day, "vix"]
        self.assertAlmostEqual(joined.loc[day, "vix_short"], vix9d.loc[day, "Close"] / 100 / vix)
        self.assertAlmostEqual(joined.loc[day, "vix_term"], vix / (vix3m.loc[day, "Close"] / 100))
        self.assertAlmostEqual(joined.loc[day, "vvix"], vvix.loc[day, "Close"] / 100)
        self.assertNotIn("vix9d", joined)
        self.assertFalse(joined.isna().any().any())

    def test_days_missing_any_index_are_dropped(self):
        day = self.base.index[30]
        joined = add_vix_family(self.base, *family(drop_day=day))
        self.assertNotIn(day, joined.index)
        self.assertEqual(len(joined), len(self.base) - 1)

    def test_gap_is_vix_minus_annualized_realized_market_volatility(self):
        gapped = add_vix_gap(self.base, window=20)
        day = gapped.index[30]
        position = self.base.index.get_loc(day)
        realized = self.base["spy_ret"].iloc[position - 19 : position + 1].std() * np.sqrt(252)
        self.assertAlmostEqual(gapped.loc[day, "vix_gap"], self.base.loc[day, "vix"] - realized)
        self.assertEqual(len(gapped), len(self.base) - 19)
        self.assertFalse(gapped.isna().any().any())

    def test_family_features_extend_the_vix_features(self):
        self.assertEqual(config.VIX_GAP_FEATURES[:-1], config.VIX_FAMILY_FEATURES)
        self.assertEqual(config.VIX_FAMILY_FEATURES[: len(config.VIX_FEATURES)], config.VIX_FEATURES)
        self.assertEqual(set(config.VIX_FAMILY_CSVS), {"^VIX9D", "^VIX3M", "^VVIX"})


class EarningsFlagTests(unittest.TestCase):
    def setUp(self):
        self.data = make_dataset()
        self.days = self.data.index

    def flagged(self, *stamps):
        out = add_earnings(self.data, pd.Series([pd.Timestamp(s) for s in stamps]))
        return list(out.index[out["earnings_next"] == 1])

    def test_after_close_report_flags_the_same_evening(self):
        day = self.days[100]
        # Reported after the close on `day`: the next trading day reacts, so `day` is the eve.
        self.assertEqual(self.flagged(f"{day.date()} 16:00:00-04:00"), [day])

    def test_pre_market_report_flags_the_evening_before(self):
        day = self.days[100]
        self.assertEqual(self.flagged(f"{day.date()} 06:00:00-04:00"), [self.days[99]])

    def test_weekend_report_flags_the_last_trading_day_before_the_reaction(self):
        friday = self.days[self.days.dayofweek == 4][20]
        saturday = friday + pd.Timedelta(days=1)
        self.assertEqual(self.flagged(f"{saturday.date()} 10:00:00-04:00"), [friday])

    def test_reports_outside_the_data_are_ignored(self):
        self.assertEqual(self.flagged("1990-01-02 16:00:00-05:00", "2040-01-02 16:00:00-05:00"), [])
        self.assertEqual(add_earnings(self.data, pd.Series([], dtype=object)).shape[0], len(self.data))


if __name__ == "__main__":
    unittest.main()
