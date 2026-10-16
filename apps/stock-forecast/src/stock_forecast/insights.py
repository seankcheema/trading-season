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
    """One row per condition: matching days and next-day up-rate in each period.

    `periods` maps a label to a split, e.g. {"train": train, "validation": val}.
    Pass the test split only after the final test has been run.
    """
    rows = []
    for name, rule in condition_rules(train).items():
        row: dict = {"condition": name}
        for label, part in periods.items():
            mask = rule(part).to_numpy()
            up = part["target"].to_numpy()[mask] > 0
            row[f"{label}_days"] = int(mask.sum())
            row[f"{label}_up_rate"] = float(up.mean()) if mask.any() else np.nan
        rows.append(row)
    return pd.DataFrame(rows)
