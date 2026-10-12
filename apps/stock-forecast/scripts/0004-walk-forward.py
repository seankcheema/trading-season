"""Walk-forward test, 2018-2023: retrain each year, score the next.

Writes reports/walk_forward.csv and a per-year chart. --with-lstm adds the
LSTM (slower: one training run per year).
"""
import argparse

import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.evaluate import plot_walk_forward
from stock_forecast.pipeline import classical_fold, load_dataset, lstm_fold
from stock_forecast.walk_forward import run_walk_forward

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--with-lstm", action="store_true")
args = parser.parse_args()

dataset = load_dataset()


def evaluate_fold(fold):
    # Each fold predicts one later year; the optional LSTM is retrained per fold.
    rows = classical_fold(fold)
    if args.with_lstm:
        rows += lstm_fold(fold)
    up_rate = float((fold.test["target"] > 0).mean())
    return [{**row, "always_up_rate": up_rate} for row in rows]


table = run_walk_forward(dataset, evaluate_fold)
# Keep per-year rows so the summary cannot hide a weak market regime.
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.WALK_FORWARD_CSV, index=False)
plot_walk_forward(table, config.REPORTS_DIR / "walk_forward.png")
summary = table.groupby("model")["direction_accuracy"].agg(["mean", "min", "max"]).dropna()
print(summary.to_string(float_format=lambda v: f"{v:.1%}"))
