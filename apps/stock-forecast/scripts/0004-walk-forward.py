"""Walk-forward test, 2018-2023: retrain each year, score the next.

Writes reports/walk_forward.csv and a per-year chart. The direction
baselines always run; --with-lstm adds the return LSTM and
--with-direction-lstm the direction LSTM (slower: one training run per year
each).
"""
import argparse

import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.evaluate import plot_walk_forward
from stock_forecast.pipeline import classical_fold, direction_fold, load_dataset, load_direction_dataset, lstm_fold
from stock_forecast.walk_forward import run_walk_forward, walk_forward_folds

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--with-lstm", action="store_true")
parser.add_argument("--with-direction-lstm", action="store_true")
args = parser.parse_args()

dataset = load_dataset()
# Test-year rows match dataset; only early-2010 warm-up rows are dropped.
direction_folds = {fold.year: fold for fold in walk_forward_folds(load_direction_dataset())}


def evaluate_fold(fold):
    # Each fold predicts one later year; the optional LSTM is retrained per fold.
    rows = classical_fold(fold)
    if args.with_lstm:
        rows += lstm_fold(fold)
    rows += direction_fold(direction_folds[fold.year], with_lstm=args.with_direction_lstm)
    up_rate = float((fold.test["target"] > 0).mean())
    return [{**row, "always_up_rate": up_rate} for row in rows]


table = run_walk_forward(dataset, evaluate_fold)
# Keep per-year rows so the summary cannot hide a weak market regime.
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.WALK_FORWARD_CSV, index=False)
plot_walk_forward(table, config.REPORTS_DIR / "walk_forward.png")
summary = table.groupby("model")["direction_accuracy"].agg(["mean", "min", "max"]).dropna()
# Years where each model beat simply calling "up" every day.
table["beat_always_up"] = table["direction_accuracy"] > table["always_up_rate"]
summary["years_beating_always_up"] = table.dropna(subset=["direction_accuracy"]).groupby("model")["beat_always_up"].sum()
summary["years_beating_always_up"] = summary["years_beating_always_up"].astype(int).astype(str) + f"/{table['year'].nunique()}"
print(summary.to_string(float_format=lambda v: f"{v:.1%}"))
if "brier_skill" in table:
    skill = table.dropna(subset=["brier_skill"]).groupby("model")["brier_skill"].agg(["mean", "min", "max"])
    print("\nBrier skill vs quoting the prior up-rate (above 0 = better probabilities):")
    print(skill.to_string(float_format=lambda v: f"{v:+.4f}"))
