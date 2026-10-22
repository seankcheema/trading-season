"""Score the platform's week-ahead trend and write the trend signal file the client UI reads.

Fits a gradient-boosted classifier on momentum inputs every month from
PLATFORM_SIGNAL_FIRST_MONTH, on the closed days before that month, and scores
each symbol's days against the pattern "the next days continue the last
PLATFORM_TREND_MOMENTUM_DAYS days' direction". Writes
apps/client-ui/public/forecast/platform-trend.json: per symbol and day the
probability that the price is higher in PLATFORM_SIGNAL_HORIZON days, the
call, the momentum, the outcome and move once known, and both readers'
running records over closed windows. Also writes
reports/platform_trend_summary.csv. Seconds. Simulated prices: a demo, never
evidence, never advice.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.platform_trend import export_trend, summarise_trend

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--horizon", type=int, default=config.PLATFORM_SIGNAL_HORIZON)
args = parser.parse_args()

document, path = export_trend(args.horizon)
summary = summarise_trend(document)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
summary.to_csv(config.PLATFORM_TREND_SUMMARY_CSV, index=False)
pd.set_option("display.width", 180)
print(summary.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
first = min(e["firstDay"] for e in document["symbols"].values())
last = max(e["lastDay"] for e in document["symbols"].values())
print(f"\nWrote {path} ({path.stat().st_size // 1024} KB): {len(document['symbols'])} symbols, {first} to {last}, "
      f"model ahead of the pattern on {int(summary['model_ahead'].sum())} of {len(summary)}")
