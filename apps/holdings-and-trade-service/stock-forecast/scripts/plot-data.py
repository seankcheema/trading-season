"""Validate the chronological dataset and save price and return charts."""
import _bootstrap  # noqa: F401

from stock_forecast import config
from stock_forecast.data import split_by_date
from stock_forecast.evaluate import plot_daily_returns, plot_price
from stock_forecast.pipeline import load_dataset

# Use the same cleaned, date-indexed dataset and split boundaries as training.
dataset = load_dataset()
split_by_date(dataset)

price_chart = plot_price(
    dataset["close"], config.PRICE_CHART, f"{config.TICKER} daily closing price"
)
returns_chart = plot_daily_returns(
    dataset["ret"], config.DAILY_RETURNS_CHART, f"{config.TICKER} daily returns"
)
print(f"Price chart: {price_chart}")
print(f"Daily returns chart: {returns_chart}")
