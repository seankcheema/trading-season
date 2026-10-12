"""Train the LSTM on the training years with early stopping on validation.

Scores it on the validation years, appends to reports/results.csv, saves the
model and scalers to models/, and draws the loss and lag-check charts.
"""
import argparse

import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import append_results, plot_actual_vs_predicted, plot_loss, predicted_prices, score
from stock_forecast.lstm_model import save_artifacts
from stock_forecast.pipeline import load_dataset, lstm_predictions

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--features", nargs="+", default=["ret"],
                    help="input columns, e.g. --features ret spy_ret volume_change")
args = parser.parse_args()

# Fit on training years; validation controls early stopping and model selection.
splits = split_by_date(load_dataset())
predicted, model, scalers, history = lstm_predictions(
    splits.train, splits.val, splits.val, history=splits.train, feature_cols=tuple(args.features), verbose=2
)
actual = splits.val["target"].to_numpy()
# Log this validation run, then save the model with its matching scalers.
name = f"LSTM ({', '.join(args.features)})"
row = score(name, actual, predicted, split="validation")
append_results([row], config.RESULTS_CSV, run="lstm")
save_artifacts(model, scalers)

close = splits.val["close"].to_numpy()
plot_loss(history, config.REPORTS_DIR / "lstm_loss.png")
plot_actual_vs_predicted(splits.val.index, predicted_prices(close, actual), predicted_prices(close, predicted),
                         config.REPORTS_DIR / "lstm_lag_check.png", "LSTM lag check, last 60 validation days")
print(row)
print(f"Stopped after {len(history['loss'])} epochs; model saved to {config.MODELS_DIR}")
