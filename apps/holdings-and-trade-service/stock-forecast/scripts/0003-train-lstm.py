"""Train an LSTM on the training years with early stopping on validation.

--task return (default) predicts tomorrow's return; --task direction predicts
the probability that tomorrow is an up day. Both are scored on the validation
years and appended to reports/results.csv. The direction task also appends
probability metrics to reports/direction_results.csv. --task volatility
predicts the probability that tomorrow is a big-move day and appends to
reports/volatility_results.csv. --sweep tries every lookback and unit count in
config on validation and saves only the run with the lowest validation log
loss.
"""
import argparse
import itertools

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import (append_results, confidence_buckets, event_confidence_buckets,
                                     plot_actual_vs_predicted, plot_confidence, plot_event_probability, plot_loss,
                                     plot_up_probability, predicted_prices, score)
from stock_forecast.lstm_model import save_artifacts
from stock_forecast.pipeline import (big_move_days, big_move_threshold, direction_baselines,
                                     direction_lstm_predictions, direction_row, load_dataset, load_direction_dataset,
                                     lstm_predictions, training_up_rate, volatility_baselines,
                                     volatility_lstm_predictions, volatility_row)

RESULT_COLUMNS = ["model", "split", "days", "return_rmse", "direction_accuracy"]

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--task", choices=["return", "direction", "volatility"], default="return")
parser.add_argument("--features", nargs="+", default=None,
                    help="input columns; default ret for return, config.DIRECTION_FEATURES or VOLATILITY_FEATURES")
parser.add_argument("--lookback", type=int, default=None,
                    help="direction and volatility only; default DIRECTION_LOOKBACK or VOLATILITY_LOOKBACK")
parser.add_argument("--units", type=int, default=None,
                    help="direction and volatility only; default DIRECTION_UNITS or VOLATILITY_UNITS")
parser.add_argument("--sweep", action="store_true", help="direction and volatility only: try the config grid")
parser.add_argument("--seed", type=int, default=config.SEED, help="direction and volatility only")
args = parser.parse_args()


def train_return_model(features: list[str]) -> None:
    # Fit on training years; validation controls early stopping and model selection.
    splits = split_by_date(load_dataset())
    predicted, model, scalers, history = lstm_predictions(
        splits.train, splits.val, splits.val, history=splits.train, feature_cols=tuple(features), verbose=2
    )
    actual = splits.val["target"].to_numpy()
    # Log this validation run, then save the model with its matching scalers.
    name = f"LSTM ({', '.join(features)})"
    row = score(name, actual, predicted, split="validation")
    append_results([row], config.RESULTS_CSV, run="lstm")
    save_artifacts(model, scalers)

    close = splits.val["close"].to_numpy()
    plot_loss(history, config.REPORTS_DIR / "lstm_loss.png")
    plot_actual_vs_predicted(splits.val.index, predicted_prices(close, actual), predicted_prices(close, predicted),
                             config.REPORTS_DIR / "lstm_lag_check.png", "LSTM lag check, last 60 validation days")
    print(row)
    print(f"Stopped after {len(history['loss'])} epochs; model saved to {config.MODELS_DIR}")


def train_direction_model(features: list[str]) -> None:
    splits = split_by_date(load_direction_dataset())
    actual = splits.val["target"].to_numpy()
    base_rate = training_up_rate(splits.train)
    settings = (list(itertools.product(config.DIRECTION_SWEEP_LOOKBACKS, config.DIRECTION_SWEEP_UNITS))
                if args.sweep else [(args.lookback or config.DIRECTION_LOOKBACK, args.units or config.DIRECTION_UNITS)])

    # The simple direction models are logged with every run, so each run's table stands alone.
    rows = [direction_row(name, actual, prob, base_rate, "validation")
            for name, prob in direction_baselines(splits.train, splits.val, history=splits.train).items()]
    runs = []
    for lookback, units in settings:
        run = direction_lstm_predictions(splits.train, splits.val, splits.val, history=splits.train,
                                         feature_cols=tuple(features), lookback=lookback, units=units,
                                         seed=args.seed, verbose=0 if args.sweep else 2)
        seed_note = "" if args.seed == config.SEED else f", seed {args.seed}"
        name = f"LSTM direction ({', '.join(features)}; {lookback}-day window, {units} units{seed_note})"
        row = {**direction_row(name, actual, run.prob_up, base_rate, "validation"),
               "epochs": len(run.loss_history["loss"])}
        print(f"{name}: accuracy {row['direction_accuracy']:.1%}, log loss {row['log_loss']:.4f}, "
              f"brier skill {row['brier_skill']:+.4f}, up calls {row['up_call_rate']:.0%}")
        rows.append(row)
        runs.append((row, run))

    # Every row, good or bad, goes in both logs; results.csv keeps its original columns.
    run_label = "lstm-direction sweep" if args.sweep else "lstm-direction"
    append_results([{k: r[k] for k in RESULT_COLUMNS} for r in rows], config.RESULTS_CSV, run=run_label)
    append_results(rows, config.DIRECTION_RESULTS_CSV, run=run_label)

    # Choose by validation log loss: it rewards honest probabilities, not lucky calls.
    best_row, best = min(runs, key=lambda pair: pair[0]["log_loss"])
    save_artifacts(best.model, best.scalers, config.DIRECTION_MODEL_DIR)

    always_up_rate = float((actual > 0).mean())
    buckets = confidence_buckets(actual, best.prob_up, config.CONFIDENCE_BUCKETS, config.DIRECTION_THRESHOLD)
    buckets.to_csv(config.REPORTS_DIR / "direction_confidence_validation.csv", index=False)
    plot_confidence(buckets, always_up_rate, config.REPORTS_DIR / "direction_confidence_validation.png",
                    "LSTM direction: accuracy by confidence, validation 2022-2023")
    plot_up_probability(splits.val.index, best.prob_up, actual, config.REPORTS_DIR / "direction_probability.png",
                        "LSTM direction: predicted vs actual up-days, validation 2022-2023")
    plot_loss(best.loss_history, config.REPORTS_DIR / "lstm_direction_loss.png", ylabel="Log loss (binary cross-entropy)")

    pd.set_option("display.width", 160)
    shown = ["model", "direction_accuracy", "balanced_accuracy", "up_call_rate", "auc", "brier_skill", "log_loss"]
    print(pd.DataFrame(rows)[shown].to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print(f"Always-up rate on validation: {always_up_rate:.1%}")
    print(buckets.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    print(f"Saved {best_row['model']} to {config.DIRECTION_MODEL_DIR}")


def train_volatility_model(features: list[str]) -> None:
    splits = split_by_date(load_direction_dataset())
    # One threshold from training labels defines "big move" for every split.
    threshold = big_move_threshold(splits.train)
    actual = big_move_days(splits.val, threshold)
    base_rate = float(big_move_days(splits.train.iloc[:-1], threshold).mean())
    settings = (list(itertools.product(config.DIRECTION_SWEEP_LOOKBACKS, config.DIRECTION_SWEEP_UNITS))
                if args.sweep else [(args.lookback or config.VOLATILITY_LOOKBACK, args.units or config.VOLATILITY_UNITS)])

    rows = [volatility_row(name, actual, prob, base_rate, "validation")
            for name, prob in volatility_baselines(splits.train, splits.val, threshold).items()]
    runs = []
    for lookback, units in settings:
        run = volatility_lstm_predictions(splits.train, splits.val, splits.val, history=splits.train,
                                          threshold=threshold, feature_cols=tuple(features), lookback=lookback,
                                          units=units, seed=args.seed, verbose=0 if args.sweep else 2)
        seed_note = "" if args.seed == config.SEED else f", seed {args.seed}"
        name = f"LSTM volatility ({', '.join(features)}; {lookback}-day window, {units} units{seed_note})"
        row = {**volatility_row(name, actual, run.prob_up, base_rate, "validation"),
               "epochs": len(run.loss_history["loss"])}
        print(f"{name}: accuracy {row['accuracy']:.1%}, log loss {row['log_loss']:.4f}, "
              f"brier skill {row['brier_skill']:+.4f}, big-move calls {row['call_rate']:.0%}")
        rows.append(row)
        runs.append((row, run))

    run_label = "lstm-volatility sweep" if args.sweep else "lstm-volatility"
    append_results([{**r, "threshold": threshold} for r in rows], config.VOLATILITY_RESULTS_CSV, run=run_label)
    best_row, best = min(runs, key=lambda pair: pair[0]["log_loss"])
    save_artifacts(best.model, best.scalers, config.VOLATILITY_MODEL_DIR)

    majority = max(actual.mean(), 1 - actual.mean())
    buckets = event_confidence_buckets(actual, best.prob_up, config.CONFIDENCE_BUCKETS, config.DIRECTION_THRESHOLD)
    buckets.to_csv(config.REPORTS_DIR / "volatility_confidence_validation.csv", index=False)
    plot_confidence(buckets, majority, config.REPORTS_DIR / "volatility_confidence_validation.png",
                    "LSTM volatility: accuracy by confidence, validation 2022-2023",
                    baseline_label="one answer every day", ylabel="Big-move accuracy (%)")
    plot_event_probability(splits.val.index, best.prob_up, actual, config.REPORTS_DIR / "volatility_probability.png",
                           "LSTM volatility: predicted vs actual big-move days, validation 2022-2023",
                           event="big-move day")
    plot_loss(best.loss_history, config.REPORTS_DIR / "lstm_volatility_loss.png", ylabel="Log loss (binary cross-entropy)")

    pd.set_option("display.width", 160)
    shown = ["model", "accuracy", "balanced_accuracy", "call_rate", "auc", "brier_skill", "log_loss"]
    print(pd.DataFrame(rows)[shown].to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print(f"Big move = next-day move larger than {threshold:.2%} either way; "
          f"{actual.mean():.1%} of validation days were big-move days")
    print(buckets.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    print(f"Saved {best_row['model']} to {config.VOLATILITY_MODEL_DIR}")


if args.task == "return":
    if args.sweep:
        parser.error("--sweep applies to --task direction only")
    train_return_model(args.features or ["ret"])
elif args.task == "direction":
    train_direction_model(args.features or config.DIRECTION_FEATURES)
else:
    train_volatility_model(args.features or config.VOLATILITY_FEATURES)
