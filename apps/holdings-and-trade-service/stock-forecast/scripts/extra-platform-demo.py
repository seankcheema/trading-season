"""Run the frozen real-data models on TradingSeason's simulated 2026 prices: a demo, not evidence.

Reads the daily CSVs in data/platform (written by export-platform-daily.py),
scores the saved direction and volatility models as trained and recalibrated
on the warm-up months, next to simple rules on the same days, and writes
reports/platform_demo.csv and reports/platform_demo.png. Nothing is trained.
--symbol runs another platform stock, through the same AAPL-trained models;
its files are named after the symbol.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_platform_demo
from stock_forecast.platform_demo import load_platform_prices, platform_dataset, platform_rows

prices = load_platform_prices()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--symbol", choices=sorted(prices), default=config.PLATFORM_SYMBOL)
args = parser.parse_args()

data = platform_dataset(prices, args.symbol)
rows, first, last = platform_rows(data)
table = pd.DataFrame(rows)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
# The default symbol keeps the documented file names; others get their own.
suffix = "" if args.symbol == config.PLATFORM_SYMBOL else f"_{args.symbol.lower()}"
results_csv = config.PLATFORM_RESULTS_CSV.with_stem(config.PLATFORM_RESULTS_CSV.stem + suffix)
table.to_csv(results_csv, index=False)
plot_platform_demo(table, results_csv.with_suffix(".png"),
                   f"Frozen real-data models on simulated {args.symbol}, {first.date()} to {last.date()} (demo)")
print(f"{args.symbol} on the platform: {len(prices)} symbols, typical daily move {data['ret'].std():.2%}, "
      f"scored {first.date()} to {last.date()}")
pd.set_option("display.width", 160)
print(table.drop(columns=["days"]).to_string(index=False, float_format=lambda v: f"{v:.3f}"))
