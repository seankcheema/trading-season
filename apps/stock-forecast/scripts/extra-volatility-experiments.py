"""Volatility experiments: do range inputs or seed averaging improve the big-move model?

Compares VOLATILITY_FEATURES with EXTENDED_VOLATILITY_FEATURES, for both
logistic regression and the LSTM. By default scores the validation years,
with EXPERIMENT_SEEDS LSTM seeds and their average. --walk-forward instead
retrains each walk-forward year with one seed. Every run is appended to
reports/volatility_results.csv. Never reads the test years.
"""
import argparse

import _bootstrap  # noqa: F401
import numpy as np
import pandas as pd

from stock_forecast import config
from stock_forecast.baselines import fit_logistic
from stock_forecast.data import add_range_features, load_prices, split_by_date
from stock_forecast.evaluate import append_results
from stock_forecast.pipeline import (big_move_days, big_move_threshold, load_direction_dataset,
                                     volatility_lstm_predictions, volatility_row)
from stock_forecast.walk_forward import walk_forward_folds

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--walk-forward", action="store_true")
args = parser.parse_args()

# Both input sets use the same rows, so the comparison is on identical days.
data = add_range_features(load_direction_dataset(), load_prices(config.PRICES_CSV))
INPUTS = {"current": config.VOLATILITY_FEATURES, "extended": config.EXTENDED_VOLATILITY_FEATURES}


def logistic_probs(fit: pd.DataFrame, part: pd.DataFrame, cols: list[str], threshold: float) -> np.ndarray:
    model = fit_logistic(fit[cols].to_numpy(), big_move_days(fit, threshold))
    return model.predict_proba(part[cols].to_numpy())[:, 1]


def validation_rows() -> list[dict]:
    splits = split_by_date(data)
    threshold = big_move_threshold(splits.train)
    actual = big_move_days(splits.val, threshold)
    base = float(big_move_days(splits.train.iloc[:-1], threshold).mean())
    rows = []
    for label, cols in INPUTS.items():
        prob = logistic_probs(splits.train.iloc[:-1], splits.val, cols, threshold)
        rows.append(volatility_row(f"Logistic regression ({label})", actual, prob, base, "validation"))
    for label, cols in INPUTS.items():
        probs = []
        for seed in range(config.SEED, config.SEED + config.EXPERIMENT_SEEDS):
            run = volatility_lstm_predictions(splits.train, splits.val, splits.val, history=splits.train,
                                              threshold=threshold, feature_cols=tuple(cols), seed=seed)
            probs.append(run.prob_up)
            rows.append(volatility_row(f"LSTM volatility ({label}; seed {seed})", actual, run.prob_up, base,
                                       "validation"))
        rows.append(volatility_row(f"LSTM volatility ({label}; {config.EXPERIMENT_SEEDS}-seed average)",
                                   actual, np.mean(probs, axis=0), base, "validation"))
    return [{**row, "threshold": threshold} for row in rows]


def walk_forward_rows() -> list[dict]:
    rows = []
    for fold in walk_forward_folds(data):
        threshold = big_move_threshold(fold.train)
        fit = pd.concat([fold.train, fold.val]).iloc[:-1]
        actual = big_move_days(fold.test, threshold)
        base = float(big_move_days(fit, threshold).mean())
        split = f"walk-forward {fold.year}"
        for label, cols in INPUTS.items():
            lstm = volatility_lstm_predictions(fold.train, fold.val, fold.test, history=fold.val,
                                               threshold=threshold, feature_cols=tuple(cols)).prob_up
            for name, prob in ((f"Logistic regression ({label})", logistic_probs(fit, fold.test, cols, threshold)),
                               (f"LSTM volatility ({label})", lstm)):
                rows.append({**volatility_row(name, actual, prob, base, split), "threshold": threshold})
    return rows


rows = walk_forward_rows() if args.walk_forward else validation_rows()
append_results(rows, config.VOLATILITY_RESULTS_CSV,
               run="experiment: walk-forward inputs" if args.walk_forward else "experiment: inputs and seed averaging")
table = pd.DataFrame(rows)
pd.set_option("display.width", 160)
if args.walk_forward:
    table["year"] = table["split"].str.removeprefix("walk-forward ").astype(int)
    print(table.pivot(index="year", columns="model", values="accuracy").to_string(float_format=lambda v: f"{v:.3f}"))
    summary = table.groupby("model").agg(mean=("accuracy", "mean"), worst=("accuracy", "min"), auc=("auc", "mean"),
                                         brier_skill=("brier_skill", "mean"))
    print(summary.to_string(float_format=lambda v: f"{v:.3f}"))
else:
    shown = ["model", "accuracy", "auc", "brier_skill", "log_loss"]
    print(table[shown].to_string(index=False, float_format=lambda v: f"{v:.4f}"))
