"""Score the six baseline forecasts on the 2022-2023 validation years.

Appends every run to reports/results.csv and saves a direction chart.
"""
import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import append_results, failed_run_row, plot_direction_accuracy
from stock_forecast.pipeline import classical_predictions, load_dataset, score_all

# Record a timestamped failure too, so a broken experiment is still visible.
try:
    splits = split_by_date(load_dataset())
    # Keep Dec 2021 as input history while fitting only labels known by year-end.
    preds, _ = classical_predictions(splits.train, splits.val, history=splits.train, include_var=False)
    actual = splits.val["target"].to_numpy()
    rows = score_all(preds, actual, split="validation")
except Exception as error:
    append_results([failed_run_row(error)], config.RESULTS_CSV, run="baselines")
    raise

# Every model above uses the same 2022-2023 target dates.
append_results(rows, config.RESULTS_CSV, run="baselines")

table = pd.DataFrame(rows)
always_up_rate = float((actual > 0).mean())
plot_direction_accuracy(table, always_up_rate, config.REPORTS_DIR / "direction_accuracy_validation.png",
                        "Direction accuracy, validation 2022-2023")
pd.set_option("display.width", 120)
print(table.to_string(index=False))
print(f"Always-up rate on validation: {always_up_rate:.1%}")
