"""Demo: did the volatility model notice the simulation's scheduled volatility spike?

Reads the spike dates from the simulation's config, scores the saved
volatility model (as trained, price inputs only, nothing retrained) on every
platform stock in data/platform, and compares spike days with the other
scored days. Writes reports/platform_spike.csv and, for --symbol (AAPL by
default), reports/platform_spike.png covering September to November 2026.
"""
import argparse

import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.evaluate import plot_spike
from stock_forecast.platform_demo import (daily_big_move_probability, load_platform_prices, platform_dataset,
                                          scheduled_spikes, spike_summary)

prices = load_platform_prices()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--symbol", choices=sorted(prices), default=config.PLATFORM_SYMBOL, help="stock to chart")
args = parser.parse_args()

spikes = scheduled_spikes()
rows, charted = [], None
for symbol in sorted(prices):
    daily = daily_big_move_probability(platform_dataset(prices, symbol))
    rows += [{"symbol": symbol, **row} for row in spike_summary(daily, spikes)]
    if symbol == args.symbol:
        charted = daily
table = pd.DataFrame(rows)
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.PLATFORM_SPIKE_CSV, index=False)
plot_spike(charted, spikes, config.PLATFORM_SPIKE_CSV.with_suffix(".png"),
           f"Simulated {args.symbol}: model's big-move probability around the scheduled spike (demo)",
           "2026-09-01", "2026-11-30")
print("Scheduled spikes:", ", ".join(f"{i} {a.date()} to {b.date()}" for i, a, b in spikes))
pd.set_option("display.width", 180)
print(table.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
