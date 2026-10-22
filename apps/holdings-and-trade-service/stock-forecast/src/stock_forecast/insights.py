"""Market conditions: how often the next day was up after each kind of day.

Descriptive statistics, not a model. Thresholds such as "high volatility"
are cut from the training split only and then applied unchanged to later
splits, so a pattern seen in training can be checked on days it never saw.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from . import config

Condition = Callable[[pd.DataFrame], pd.Series]


def condition_rules(train: pd.DataFrame) -> dict[str, Condition]:
    """Named rules, each a day-t condition known at that day's close."""
    vol = f"volatility_{config.VOLATILITY_WINDOW}"
    mom = f"momentum_{config.MOMENTUM_WINDOW}"
    # Quantiles come from training rows only; later splits reuse these fixed cut-offs.
    high_vol, low_vol = train[vol].quantile(0.8), train[vol].quantile(0.2)
    volume_surge = train["volume_change"].quantile(0.9)
    return {
        "Every day": lambda d: pd.Series(True, index=d.index),
        "After an up day": lambda d: d["ret"] > 0,
        "After a down day": lambda d: d["ret"] < 0,
        "After a gain of 2% or more": lambda d: d["ret"] >= 0.02,
        "After a drop of 2% or more": lambda d: d["ret"] <= -0.02,
        "After a market (SPY) down day": lambda d: d["spy_ret"] < 0,
        "AAPL up while the market fell": lambda d: (d["ret"] > 0) & (d["spy_ret"] < 0),
        "High volatility (top 20% in training)": lambda d: d[vol] > high_vol,
        "Low volatility (bottom 20% in training)": lambda d: d[vol] < low_vol,
        f"Positive {config.MOMENTUM_WINDOW}-day momentum": lambda d: d[mom] > 0,
        f"Negative {config.MOMENTUM_WINDOW}-day momentum": lambda d: d[mom] < 0,
        "Volume surge (top 10% in training)": lambda d: d["volume_change"] > volume_surge,
    }


def market_conditions(train: pd.DataFrame, periods: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """One row per condition: matching days, next-day up-rate and mean next-day return in each period.

    The up-rate counts days; the mean return also weighs how big the moves
    were, which is what mean reversion is about.

    `periods` maps a label to a split, e.g. {"train": train, "validation": val}.
    Pass the test split only after the final test has been run.
    """
    rows = []
    for name, rule in condition_rules(train).items():
        row: dict = {"condition": name}
        for label, part in periods.items():
            mask = rule(part).to_numpy()
            next_returns = part["target"].to_numpy()[mask]
            row[f"{label}_days"] = int(mask.sum())
            row[f"{label}_up_rate"] = float((next_returns > 0).mean()) if mask.any() else np.nan
            row[f"{label}_mean_return"] = float(next_returns.mean()) if mask.any() else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def return_autocorrelation(periods: dict[str, pd.DataFrame], lags: range = range(1, 6)) -> pd.DataFrame:
    """Correlation between each day's return and the return `lag` days later, per period.

    Negative values mean moves tend to partly reverse (mean reversion);
    positive values mean they tend to continue (momentum). Under no
    relationship, values fall within about two standard errors of zero,
    where one standard error is roughly 1 / sqrt(days).
    """
    rows = []
    for label, part in periods.items():
        returns = part["ret"]
        for lag in lags:
            # Descriptive only, never a model input. Both series come from the same split,
            # so no return from a later split is paired in.
            pairs = pd.concat([returns, returns.shift(-lag)], axis=1).dropna()
            rows.append({
                "period": label,
                "lag_days": lag,
                "days": len(pairs),
                "autocorrelation": float(pairs.iloc[:, 0].corr(pairs.iloc[:, 1])),
                "standard_error": float(1 / np.sqrt(len(pairs))),
            })
    table = pd.DataFrame(rows)
    table["beyond_noise"] = table["autocorrelation"].abs() > 2 * table["standard_error"]
    return table
