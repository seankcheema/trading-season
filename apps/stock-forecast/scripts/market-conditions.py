"""Next-day up-rates after common market conditions, training vs validation.

Descriptive talking points, not a model: does a pattern seen in 2010-2021
still hold in 2022-2023? Thresholds are cut from training rows only. The test
years are left out so this cannot steer model choices before the final run.
Writes reports/market_conditions.csv and reports/market_conditions.png.
"""
import _bootstrap  # noqa: F401
import pandas as pd

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import plot_market_conditions
from stock_forecast.insights import market_conditions
from stock_forecast.pipeline import load_direction_dataset

splits = split_by_date(load_direction_dataset())
# Drop the last row of each split: its label is the next split's first day.
table = market_conditions(splits.train, {"train": splits.train.iloc[:-1], "validation": splits.val.iloc[:-1]})
config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
table.to_csv(config.MARKET_CONDITIONS_CSV, index=False)
plot_market_conditions(table, config.REPORTS_DIR / "market_conditions.png",
                       f"{config.TICKER}: next-day up-rate after each condition")
pd.set_option("display.width", 160)
print(table.to_string(index=False, float_format=lambda v: f"{v:.1%}"))
