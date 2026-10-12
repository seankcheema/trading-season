"""Synthetic data for tests: random-walk prices with no real pattern to find."""
import numpy as np
import pandas as pd

from stock_forecast.data import build_dataset


def make_prices(seed: int = 0, start: str = "2014-01-01", end: str = "2026-09-30",
                drift: float = 0.0004, vol: float = 0.017, start_price: float = 100.0) -> pd.DataFrame:
    """Daily OHLCV bars on business days, with log-normal random-walk closes."""
    # Synthetic random walks keep tests deterministic and independent of Yahoo Finance.
    index = pd.bdate_range(start, end, name="Date")
    rng = np.random.default_rng(seed)
    close = start_price * np.exp(np.cumsum(rng.normal(drift, vol, len(index))))
    open_ = close * (1 + rng.normal(0, 0.002, len(index)))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.003, len(index))))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.003, len(index))))
    volume = rng.integers(1_000_000, 5_000_000, len(index))
    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume}, index=index)


def make_dataset(seed: int = 0, start: str = "2014-01-01") -> pd.DataFrame:
    """A model-ready dataset built from two independent random walks."""
    return build_dataset(
        make_prices(seed, start=start), make_prices(seed + 1, start=start, start_price=300.0)
    )


def simulate_var(coefs: list, intercept: list, n: int, noise: float = 0.5, seed: int = 0,
                 columns=("a", "b")) -> pd.DataFrame:
    """Simulate a VAR with known coefficients (coefs[i] multiplies the value i + 1 steps back)."""
    # Burn in initial zero rows so tests measure the stable process, not startup.
    rng = np.random.default_rng(seed)
    coefs = [np.asarray(c, dtype=float) for c in coefs]
    intercept = np.asarray(intercept, dtype=float)
    k, p, burn = len(intercept), len(coefs), 200
    y = np.zeros((n + burn, k))
    for t in range(p, n + burn):
        y[t] = intercept + sum(coefs[i] @ y[t - 1 - i] for i in range(p)) + rng.normal(0, noise, k)
    return pd.DataFrame(y[burn:], columns=list(columns))
