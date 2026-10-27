"""Can the frozen volatility model be made useful on the platform's prices without retraining?

Scores four no-retrain variants (the saved model as is, the same score
calibrated on earlier platform days, a persistence regression fit on the
platform, and their blend) month by month through the platform year on every
platform symbol, against one answer every day and "same as today". A big move
is bigger than the symbol's usual move over the 40 days before it. Writes
reports/platform_calibration.csv and .png. --with-platform-lstm also trains
one LSTM on the platform's own market and scores it on the later months, with
one line per epoch; the table is then limited to the months every variant
covers. --symbols limits the run. Simulated prices: a demo, never evidence.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_platform_calibration
from stock_forecast.platform_calibration import PLATFORM_LSTM, SAME_AS_TODAY, calibration_rows, summarise

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--with-platform-lstm", action="store_true")
parser.add_argument("--symbols", nargs="+", default=None, help="platform symbols to run; default every exported one")
parser.add_argument("--quiet", action="store_true", help="no per-epoch lines from the platform LSTM")
args = parser.parse_args()

rows = calibration_rows(args.symbols, args.with_platform_lstm, verbose=0 if args.quiet else 2)
months = None
if args.with_platform_lstm:
    months = sorted(rows.loc[rows["variant"] == PLATFORM_LSTM, "month"].unique())
summary = summarise(rows, months)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
summary.to_csv(config.PLATFORM_CALIBRATION_CSV, index=False)
span = f"last {summary['months'].max()} months of the platform's 2026, {int(summary['days'].max())} days per symbol"
plot_platform_calibration(summary, config.REPORTS_DIR / "platform_calibration.png",
                          f"Bigger move than usual tomorrow? Accuracy on the platform's prices\n{span}", SAME_AS_TODAY)

pd.set_option("display.width", 200)
shown = ["symbol", "variant", "days", "accuracy", "rule_accuracy", "auc", "brier_skill", "call_rate", "usable"]
print(summary[shown].to_string(index=False, float_format=lambda v: f"{v:.3f}"))
print("\nAcross symbols: mean accuracy, mean AUC and how many symbols each variant is usable on")
across = summary.groupby("variant", sort=False).agg(accuracy=("accuracy", "mean"), auc=("auc", "mean"),
                                                     brier_skill=("brier_skill", "mean"), usable_on=("usable", "sum"))
across["usable_on"] = across["usable_on"].astype(str) + f"/{summary['symbol'].nunique()}"
print(across.to_string(float_format=lambda v: f"{v:.3f}"))
