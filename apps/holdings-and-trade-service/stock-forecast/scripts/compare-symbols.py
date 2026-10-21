"""Run both models on each symbol in COMPARISON_SYMBOLS with the settings chosen for AAPL.

Scores validation and walk-forward only; the test years stay sealed.
Writes reports/symbol_comparison.csv (every row) and
reports/symbol_comparison.png (walk-forward averages). --no-lstm runs the
regressions alone, in seconds. --symbols runs only the listed symbols and
keeps the saved rows of the others, so adding one stock takes minutes.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_symbol_comparison
from stock_forecast.symbols import merge_results, summarise, symbol_rows

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--no-lstm", action="store_true")
parser.add_argument("--symbols", nargs="+", choices=config.COMPARISON_SYMBOLS, default=config.COMPARISON_SYMBOLS,
                    help="symbols to run; the others keep their saved rows")
args = parser.parse_args()

new = pd.DataFrame([row for symbol in args.symbols for row in symbol_rows(symbol, not args.no_lstm)])
saved = pd.read_csv(config.SYMBOL_COMPARISON_CSV) if config.SYMBOL_COMPARISON_CSV.exists() else None
table = merge_results(saved, new)
# Report in the configured order, whichever symbols this run covered.
table = table.sort_values("symbol", key=lambda s: s.map(config.COMPARISON_SYMBOLS.index), kind="stable")
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.SYMBOL_COMPARISON_CSV, index=False)
summary = summarise(table)
plot_symbol_comparison(summary, config.REPORTS_DIR / "symbol_comparison.png",
                       "Same models and settings, " + " vs ".join(dict.fromkeys(table["symbol"])))
pd.set_option("display.width", 180)
summary["years_beating_bar"] = summary["years_beating_bar"].astype(str) + "/" + summary["years"].astype(str)
print(summary.drop(columns="years").to_string(index=False, float_format=lambda v: f"{v:.3f}"))
