"""When would the direction model tell a client to buy? Test a P(up) cutoff.

A day is flagged when P(up) is at or above a cutoff from BUY_SIGNAL_CUTOFFS.
Walk-forward: each year's cutoff is chosen on the year before and scored on
the year itself. The validation row shows the cutoff a test run would freeze,
chosen on 2022-2023. The test years stay sealed. Writes reports/buy_signal.csv, buy_signal_summary.csv and buy_signal.png;
--no-lstm runs the indicator regression alone, in seconds.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.buy_signal import buy_signal_fold, summarise_signals, validation_cutoffs
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import plot_buy_signal
from stock_forecast.pipeline import load_direction_dataset
from stock_forecast.walk_forward import run_walk_forward

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--no-lstm", action="store_true")
args = parser.parse_args()

dataset = load_direction_dataset()
walk = run_walk_forward(dataset, lambda fold: buy_signal_fold(fold, with_lstm=not args.no_lstm))
splits = split_by_date(dataset)
chosen = pd.DataFrame(validation_cutoffs(splits.train, splits.val, with_lstm=not args.no_lstm))
chosen.insert(0, "split", f"validation {config.VAL_START[:4]}-{config.VAL_END[:4]} (cutoff chosen here)")
logged = walk.drop(columns="year").copy()
logged.insert(0, "split", "walk-forward " + walk["year"].astype(str))
table = pd.concat([logged, chosen], ignore_index=True)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.BUY_SIGNAL_CSV, index=False)
plot_buy_signal(walk, config.REPORTS_DIR / "buy_signal.png",
                "Buy signal: did the days the model flagged go up more often than any day?")

pd.set_option("display.width", 180)
shown = ["split", "model", "cutoff", "signals", "hit_rate", "up_rate", "edge", "signal_mean_return", "mean_return"]
print(table[shown].to_string(index=False, float_format=lambda v: f"{v:.4f}"))
# A year counts only if the signal fired and its flagged days beat that year's up-rate.
summary = summarise_signals(walk)
summary.to_csv(config.BUY_SIGNAL_SUMMARY_CSV, index=False)
print("\nWalk-forward: flagged days against what each year's up-rate predicts for them")
print(summary.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
