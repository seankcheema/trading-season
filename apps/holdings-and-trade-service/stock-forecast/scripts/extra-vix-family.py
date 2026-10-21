"""Volatility experiment: do VIX9D, VIX3M, VVIX and the fear-vs-reality gap add to VIX alone?

Runs walk-forward 2018-2023 on each symbol in VIX_FAMILY_SYMBOLS with the
AAPL settings, prints one line per model trained, and writes
reports/vix_family_comparison.csv. --verbose adds one line per epoch.
Single stocks with saved earnings dates (0001 --earnings) also get an
earnings variant. Needs 0001-download-data.py --vix and --vix-family first.
--symbols runs only some symbols and keeps the others' saved rows. Never
reads the test years.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.symbols import merge_results, summarise
from stock_forecast.vix_family import vix_family_rows

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--verbose", action="store_true", help="print one line per training epoch")
parser.add_argument("--symbols", nargs="+", choices=config.VIX_FAMILY_SYMBOLS, default=config.VIX_FAMILY_SYMBOLS,
                    help="symbols to run; the others keep their saved rows")
args = parser.parse_args()

new = pd.DataFrame(vix_family_rows(args.symbols, verbose=2 if args.verbose else 0))
saved = (pd.read_csv(config.VIX_FAMILY_COMPARISON_CSV) if config.VIX_FAMILY_COMPARISON_CSV.exists() else None)
table = merge_results(saved, new)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.VIX_FAMILY_COMPARISON_CSV, index=False)
summary = summarise(table).drop(columns=["validation_accuracy", "task"])
summary["years_beating_bar"] = summary["years_beating_bar"].astype(str) + "/" + summary["years"].astype(str)
pd.set_option("display.width", 160)
print(summary.drop(columns="years").to_string(index=False, float_format=lambda v: f"{v:.3f}"))
