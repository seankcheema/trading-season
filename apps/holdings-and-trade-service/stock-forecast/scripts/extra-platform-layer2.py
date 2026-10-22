"""A second layer over the platform model: can it beat the pattern rule, and by how much?

For one horizon, trains the platform LSTM once (seed 42) and as a seed
ensemble, then scores every symbol month by month against the rules, with
three second-layer readings of each model: its score calibrated on earlier
days, its level against its own recent past (own median), and a stacker over
the model and the persistence inputs. --features extended adds the intraday
range inputs. Every fit sees only earlier days; the table covers the months
every variant has. Writes reports/platform_layer2_<H>d_<features>.csv.
Simulated prices: a demo, never evidence.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.platform_calibration import PLATFORM_LSTM, summarise
from stock_forecast.platform_demo import load_platform_prices, platform_dataset
from stock_forecast.platform_horizon import (ensemble_platform_lstm, horizon_daily, horizon_rows,
                                             platform_dataset_extended, platform_horizon_lstm)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--horizon", type=int, default=5)
parser.add_argument("--seeds", type=int, default=config.EXPERIMENT_SEEDS)
parser.add_argument("--features", choices=["base", "extended"], default="base")
parser.add_argument("--symbols", nargs="+", default=None)
args = parser.parse_args()

prices = load_platform_prices()
symbols = args.symbols or sorted(prices)
build = platform_dataset_extended if args.features == "extended" else platform_dataset
cols = tuple(config.EXTENDED_VOLATILITY_FEATURES if args.features == "extended" else config.VOLATILITY_FEATURES)
datasets = {symbol: build(prices, symbol) for symbol in symbols}
ENSEMBLE = f"{PLATFORM_LSTM}, {args.seeds}-seed ensemble"

single = platform_horizon_lstm(datasets, args.horizon, feature_cols=cols, verbose=0)
ensemble = ensemble_platform_lstm(datasets, args.horizon, seeds=args.seeds, feature_cols=cols, verbose=0)
rows = pd.concat([
    horizon_rows(horizon_daily(datasets[s], args.horizon), s, args.horizon,
                 extra={PLATFORM_LSTM: single[s], ENSEMBLE: ensemble[s]})
    for s in symbols
], ignore_index=True)
covered = rows.groupby("variant")["month"].apply(set)
months = sorted(set.intersection(*covered))
summary = summarise(rows, months)
summary.insert(0, "features", args.features)
summary.insert(0, "horizon_days", args.horizon)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
summary.to_csv(config.REPORTS_DIR / f"{config.PLATFORM_LAYER2_CSV.stem}_{args.horizon}d_{args.features}.csv", index=False)

pd.set_option("display.width", 220)
print(f"\n{args.horizon}-day window, {args.features} features, months {months[0]} to {months[-1]}, "
      f"{int(summary['days'].max())} days per symbol")
across = summary.groupby("variant", sort=False).agg(accuracy=("accuracy", "mean"), auc=("auc", "mean"),
                                                     brier_skill=("brier_skill", "mean"), usable_on=("usable", "sum"))
across["usable_on"] = across["usable_on"].astype(str) + f"/{summary['symbol'].nunique()}"
print(across.sort_values("accuracy", ascending=False).to_string(float_format=lambda v: f"{v:.3f}"))
