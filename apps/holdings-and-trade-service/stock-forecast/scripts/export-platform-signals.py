"""Train the platform's week-ahead risk model and write the signal file the client UI reads.

Trains one LSTM on the platform's own market for the PLATFORM_SIGNAL_HORIZON
day question (will the next days be more volatile than usual for this
stock?), scores every symbol's days after the training span, and writes
apps/client-ui/public/forecast/platform-signals.json: per symbol and day the
probability, the call, the usual level, and the running track record of the
model and of the rule "like the last days", counted only over closed
windows. Also writes reports/platform_signals_summary.csv. --retrain monthly
refreshes the model every scored month instead of training once, the way a
production model would be kept current. Prints one line per epoch; --quiet
does not. Simulated prices: a demo, never evidence.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.platform_signals import export_signals, summarise_signals

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--horizon", type=int, default=config.PLATFORM_SIGNAL_HORIZON)
parser.add_argument("--retrain", choices=["once", "monthly"], default="once",
                    help="once: one model fit to PLATFORM_LSTM_TRAIN_END; monthly: refreshed every scored month")
parser.add_argument("--quiet", action="store_true")
args = parser.parse_args()

document, path = export_signals(args.horizon, verbose=0 if args.quiet else 2, retrain=args.retrain)
summary = summarise_signals(document)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
summary.to_csv(config.PLATFORM_SIGNALS_SUMMARY_CSV, index=False)
pd.set_option("display.width", 160)
print(summary.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
first = min(e["firstDay"] for e in document["symbols"].values())
last = max(e["lastDay"] for e in document["symbols"].values())
print(f"\nWrote {path} ({path.stat().st_size // 1024} KB): {len(document['symbols'])} symbols, {first} to {last}, "
      f"model ahead of the rule on {int(summary['model_ahead'].sum())} of {len(summary)}")
