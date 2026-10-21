"""Volatility experiment: how far ahead can the big-move model see, and does a sliding training window help?

For each symbol and prediction window H in --horizons, predicts whether
realized volatility over the next H days will be above its training median,
with the VIX-family inputs, walk-forward 2018-2023. --train-years N trains
on only the last N years before each validation year instead of all
history. --no-lstm runs the logistic regression alone, in seconds.
Results merge into reports/horizon_comparison.csv by symbol, window,
training window and model. Never reads the test years.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.horizons import horizon_rows
from stock_forecast.symbols import merge_results

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--symbols", nargs="+", choices=config.VIX_FAMILY_SYMBOLS, default=config.VIX_FAMILY_SYMBOLS)
parser.add_argument("--horizons", nargs="+", type=int, default=config.HORIZONS)
parser.add_argument("--train-years", type=int, default=None, help="sliding training window in years")
parser.add_argument("--no-lstm", action="store_true")
parser.add_argument("--verbose", action="store_true", help="print one line per training epoch")
args = parser.parse_args()

new = pd.DataFrame([row for symbol in args.symbols for h in args.horizons
                    for row in horizon_rows(symbol, h, not args.no_lstm, args.train_years, 2 if args.verbose else 0)])
saved = pd.read_csv(config.HORIZON_COMPARISON_CSV) if config.HORIZON_COMPARISON_CSV.exists() else None
table = merge_results(saved, new, keys=("symbol", "horizon_days", "training_window", "model"))
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.HORIZON_COMPARISON_CSV, index=False)

new["beat"] = new["accuracy"] > new["bar_to_clear"]
summary = new.groupby(["symbol", "training_window", "horizon_days", "model"], sort=False).agg(
    accuracy=("accuracy", "mean"), bar_to_clear=("bar_to_clear", "mean"), worst_year=("accuracy", "min"),
    years_beating_bar=("beat", "sum"), brier_skill=("brier_skill", "mean")).reset_index()
summary["edge"] = summary["accuracy"] - summary["bar_to_clear"]
pd.set_option("display.width", 180)
print(summary.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
