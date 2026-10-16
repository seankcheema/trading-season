"""Download, load and shape the daily price data.

Row t of the dataset holds what is known at day t's close (its return, its
volume change, the market's return) plus the target: day t+1's return.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from . import config

REQUIRED_COLUMNS = ["Open", "High", "Low", "Close", "Volume"]


@dataclass(frozen=True)
class Splits:
    """The three chronological parts of the dataset."""

    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def download_prices(ticker: str, start: str = config.START, end: str = config.END) -> pd.DataFrame:
    """Download adjusted daily OHLCV bars from Yahoo Finance.

    Raises instead of returning partial or invented data: a failed download
    must stop the pipeline, never fall back to simulated prices.
    """
    import yfinance as yf  # imported here so tests and offline runs never need it

    # Keep yfinance's columns flat so the saved CSV has one column per field.
    frame = yf.download(
        ticker, start=start, end=end, auto_adjust=True, multi_level_index=False, progress=False
    )
    if frame is None or frame.empty:
        raise RuntimeError(f"No data returned for {ticker}; check the ticker and your connection")
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise RuntimeError(f"Download for {ticker} is missing columns {missing}")
    frame = frame[REQUIRED_COLUMNS].copy()
    frame.index.name = "Date"
    return frame


def save_prices(prices: pd.DataFrame, path: Path, overwrite: bool = False) -> None:
    """Save prices to CSV, refusing to replace an existing snapshot by accident."""
    path = Path(path)
    if path.exists() and not overwrite:
        raise FileExistsError(f"{path} already exists; pass overwrite=True to replace it")
    path.parent.mkdir(parents=True, exist_ok=True)
    prices.to_csv(path)


def load_prices(path: Path) -> pd.DataFrame:
    """Load a saved price snapshot and check it is usable."""
    prices = pd.read_csv(path, index_col=0, parse_dates=True)
    missing = [c for c in REQUIRED_COLUMNS if c not in prices.columns]
    if missing:
        raise ValueError(f"{path} is missing columns {missing}")
    prices = prices.sort_index()
    if prices.index.has_duplicates:
        raise ValueError(f"{path} has duplicate dates")
    if prices["Close"].isna().any():
        raise ValueError(f"{path} has missing closing prices")
    return prices[REQUIRED_COLUMNS]


def add_features(prices: pd.DataFrame) -> pd.DataFrame:
    """Turn raw prices into model columns.

    Columns: close, ret (today's return), volume_change (log change in
    volume), target (tomorrow's return). Leaves NaN rows for the caller.
    """
    features = pd.DataFrame(index=prices.index)
    features["close"] = prices["Close"]
    features["ret"] = prices["Close"].pct_change()
    features["volume_change"] = np.log(prices["Volume"].replace(0, np.nan)).diff()
    # Label today's known inputs with the return that happens on the next day.
    features["target"] = features["ret"].shift(-1)
    return features


def build_dataset(prices: pd.DataFrame, market: pd.DataFrame) -> pd.DataFrame:
    """Join the stock's features with the market's daily return.

    Keeps only dates present in both files and drops rows with any missing
    value (the first day has no return, the last day has no target).
    """
    features = add_features(prices)
    market_ret = market["Close"].pct_change().rename("spy_ret")
    # Joining by date avoids pairing AAPL with the wrong SPY trading session.
    dataset = features.join(market_ret, how="inner").dropna()
    return dataset[["close", "ret", "spy_ret", "volume_change", "target"]]


def add_indicators(
    dataset: pd.DataFrame,
    volatility_window: int = config.VOLATILITY_WINDOW,
    momentum_window: int = config.MOMENTUM_WINDOW,
) -> pd.DataFrame:
    """Add backward-looking market indicators for the direction and volatility models.

    volatility_10 is the standard deviation of the last 10 returns and
    momentum_20 the price change over the last 20 trading days, both ending
    at day t's close. abs_ret and spy_abs_ret are the size of today's AAPL
    and SPY moves, whatever their direction. The warm-up rows without a full window are dropped;
    they all fall in early 2010, inside the training split.
    """
    indicators = dataset.copy()
    # Rolling windows and positive shifts only look back; the target stays the only future value.
    indicators[f"volatility_{volatility_window}"] = dataset["ret"].rolling(volatility_window).std()
    indicators[f"momentum_{momentum_window}"] = dataset["close"].pct_change(momentum_window)
    indicators["abs_ret"] = dataset["ret"].abs()
    indicators["spy_abs_ret"] = dataset["spy_ret"].abs()
    return indicators.dropna()


def add_range_features(dataset: pd.DataFrame, prices: pd.DataFrame) -> pd.DataFrame:
    """Add intraday-range and longer-volatility inputs, used by the volatility experiments.

    range is day t's (high - low) / close, known at its close; range_10 is
    its 10-day mean; volatility_20 and volatility_60 are the standard
    deviations of the last 20 and 60 returns. Warm-up rows are dropped.
    """
    extended = dataset.copy()
    # Align by date so a missing price row can never shift ranges onto the wrong day.
    extended["range"] = ((prices["High"] - prices["Low"]) / prices["Close"]).reindex(dataset.index)
    extended["range_10"] = extended["range"].rolling(10).mean()
    extended["volatility_20"] = dataset["ret"].rolling(20).std()
    extended["volatility_60"] = dataset["ret"].rolling(60).std()
    return extended.dropna()


def split_by_date(
    dataset: pd.DataFrame,
    train_end: str = config.TRAIN_END,
    val_start: str = config.VAL_START,
    val_end: str = config.VAL_END,
    test_start: str = config.TEST_START,
) -> Splits:
    """Split by date into train, validation and test. Never shuffles."""
    # Reject invalid boundaries before slicing so the intended date windows
    # cannot silently overlap or run backward.
    boundaries = [pd.Timestamp(value) for value in (train_end, val_start, val_end, test_start)]
    if not (boundaries[0] < boundaries[1] <= boundaries[2] < boundaries[3]):
        raise ValueError("Split dates overlap or are out of order")
    if not dataset.index.is_monotonic_increasing:
        raise ValueError("Dataset dates must be in chronological order")
    if dataset.index.has_duplicates:
        raise ValueError("Dataset contains duplicate dates")
    if dataset.isna().any().any():
        raise ValueError("Dataset contains missing values")

    train = dataset.loc[:train_end]
    val = dataset.loc[val_start:val_end]
    test = dataset.loc[test_start:]
    # Fail early if a changed date range accidentally empties or overlaps a split.
    for name, part in (("train", train), ("validation", val), ("test", test)):
        if part.empty:
            raise ValueError(f"The {name} split is empty; check the split dates against the data")
    if not (train.index.max() < val.index.min() and val.index.max() < test.index.min()):
        raise ValueError("Splits overlap or are out of order")
    if any(part.isna().any().any() for part in (train, val, test)):
        raise ValueError("A split contains missing values")
    return Splits(train=train, val=val, test=test)
