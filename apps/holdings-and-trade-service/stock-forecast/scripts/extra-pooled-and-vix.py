"""Volatility experiment: does VIX, or one model shared by all stocks, beat one model per stock?

For every symbol in COMPARISON_SYMBOLS, compares the logistic regression and
the per-stock LSTM, each with and without the VIX inputs, against one LSTM
trained on all the stocks together, with and without VIX. All use the
settings chosen for AAPL. Scores validation and walk-forward only; the test
years stay sealed. Writes reports/pooled_vix_comparison.csv and .png.
Takes one to two hours on a laptop CPU. Prints one line per model trained;
--verbose also prints one line per training epoch.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_symbol_comparison
from stock_forecast.pooled import pooled_vix_rows
from stock_forecast.symbols import summarise

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--verbose", action="store_true", help="print one line per training epoch")
args = parser.parse_args()

table = pd.DataFrame(pooled_vix_rows(verbose=2 if args.verbose else 0))
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.POOLED_COMPARISON_CSV, index=False)
summary = summarise(table)
plot_symbol_comparison(summary, config.REPORTS_DIR / "pooled_vix_comparison.png",
                       "Big-move models: one stock vs all stocks, with and without VIX")
pd.set_option("display.width", 180)
summary["years_beating_bar"] = summary["years_beating_bar"].astype(str) + "/" + summary["years"].astype(str)
print(summary.drop(columns=["years", "task"]).to_string(index=False, float_format=lambda v: f"{v:.3f}"))
