"""Score the baselines, regressions and the VAR on the validation years.

Appends every row to reports/results.csv and saves a direction chart.
"""
import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import append_results, plot_direction_accuracy
from stock_forecast.pipeline import classical_predictions, load_dataset, score_all

# Score every baseline on the same validation dates before judging the LSTM.
splits = split_by_date(load_dataset())
preds, info = classical_predictions(splits.train, splits.val, history=splits.train)
actual = splits.val["target"].to_numpy()
rows = score_all(preds, actual, split="validation")
append_results(rows, config.RESULTS_CSV, run="baselines")

table = pd.DataFrame(rows)
always_up_rate = float((actual > 0).mean())
plot_direction_accuracy(table, always_up_rate, config.REPORTS_DIR / "direction_accuracy_validation.png",
                        "Direction accuracy, validation 2022-2023")
pd.set_option("display.width", 120)
print(table.to_string(index=False))
if info["var_order"] is not None:
    print(f"\nVAR order chosen by AIC on the training years: {info['var_order']}")
print(f"Always-up rate on validation: {always_up_rate:.1%}")
