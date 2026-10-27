"""Will the next H days be more volatile than usual? The platform question at a longer horizon.

Scores, month by month on every platform symbol, a persistence regression fit
on the platform against the two rules a client could follow without a model
(one answer every day, and "the next H days will be like the last H"). The
label is the realized volatility of the next H days against its usual level
over the 40 days before. --with-platform-lstm also trains one LSTM on the
platform's own market for the same label, with one line per epoch, and limits
the table to the months every variant covers. Writes
reports/platform_horizon.csv and .png, both tagged with the horizon. Simulated
prices: a demo, never evidence.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_platform_calibration
from stock_forecast.platform_calibration import summarise
from stock_forecast.platform_horizon import SAME_AS_LAST, horizon_calibration_rows

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--horizon", type=int, default=5, help="trading days in the prediction window")
parser.add_argument("--with-platform-lstm", action="store_true")
parser.add_argument("--symbols", nargs="+", default=None, help="platform symbols to run; default every exported one")
parser.add_argument("--quiet", action="store_true", help="no per-epoch lines from the platform LSTM")
args = parser.parse_args()

rows = horizon_calibration_rows(args.horizon, args.symbols, args.with_platform_lstm, verbose=0 if args.quiet else 2)
# Compare every variant on the same days: only the months all of them cover (the calibrated
# ones start later, needing earlier scored days to fit on).
covered = rows.groupby("variant")["month"].apply(set)
months = sorted(set.intersection(*covered)) if args.with_platform_lstm else None
summary = summarise(rows, months)
summary.insert(0, "horizon_days", args.horizon)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
stem = config.PLATFORM_HORIZON_CSV.stem
summary.to_csv(config.REPORTS_DIR / f"{stem}_{args.horizon}d.csv", index=False)
span = f"last {summary['months'].max()} months of the platform's 2026, {int(summary['days'].max())} days per symbol"
plot_platform_calibration(summary, config.REPORTS_DIR / f"{stem}_{args.horizon}d.png",
                          f"More volatile than usual over the next {args.horizon} days? Accuracy on the platform's prices\n{span}",
                          SAME_AS_LAST)

pd.set_option("display.width", 200)
shown = ["symbol", "variant", "days", "accuracy", "rule_accuracy", "auc", "brier_skill", "call_rate", "usable"]
print(summary[shown].to_string(index=False, float_format=lambda v: f"{v:.3f}"))
print(f"\n{args.horizon}-day window, across symbols: mean accuracy, mean AUC and how many symbols each variant is usable on")
across = summary.groupby("variant", sort=False).agg(accuracy=("accuracy", "mean"), auc=("auc", "mean"),
                                                     brier_skill=("brier_skill", "mean"), usable_on=("usable", "sum"))
across["usable_on"] = across["usable_on"].astype(str) + f"/{summary['symbol'].nunique()}"
print(across.to_string(float_format=lambda v: f"{v:.3f}"))
