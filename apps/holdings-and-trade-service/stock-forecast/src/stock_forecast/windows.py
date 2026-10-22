"""Sliding windows for sequence models, with scaling fit on training rows only.

A window for day t holds the last LOOKBACK days of features ending at t
(inclusive). Its label is that day's target, i.e. day t+1's return.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from . import config


@dataclass
class Scalers:
    """Feature and target scalers, both fit on the training split only."""

    features: StandardScaler
    target: StandardScaler
    feature_cols: tuple[str, ...]
    target_col: str = "target"


def fit_scalers(
    train: pd.DataFrame, feature_cols: tuple[str, ...] = ("ret",), target_col: str = "target"
) -> Scalers:
    """Fit one StandardScaler on the feature columns and one on the target."""
    # Fit only on training rows; validation and test statistics must stay unseen.
    features = StandardScaler().fit(train[list(feature_cols)].to_numpy())
    target = StandardScaler().fit(train[[target_col]].to_numpy())
    return Scalers(features=features, target=target, feature_cols=tuple(feature_cols), target_col=target_col)


def with_history(part: pd.DataFrame, history: pd.DataFrame | None, rows_needed: int) -> pd.DataFrame:
    """Prepend the last `rows_needed` rows of history (earlier dates) to part."""
    if history is None or rows_needed <= 0:
        return part
    return pd.concat([history.tail(rows_needed), part])


def aligned_rows(part: pd.DataFrame, lookback: int = config.LOOKBACK, history: pd.DataFrame | None = None) -> pd.DataFrame:
    """The rows of `part` that get a window: all of them when history is given."""
    return part if history is not None else part.iloc[lookback - 1:]


def make_windows(
    part: pd.DataFrame,
    scalers: Scalers,
    lookback: int = config.LOOKBACK,
    history: pd.DataFrame | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Build (X, y) for one split.

    X has shape (samples, lookback, n_features); y has shape (samples,), both
    scaled. Without history the first lookback - 1 rows of part are only used
    as context. With history (the previous split), every row of part gets a
    window, and the history rows are earlier dates, so nothing leaks.
    """
    # Prior-split rows supply context only; output labels remain aligned to `part`.
    rows = with_history(part, history, lookback - 1)
    if len(rows) < lookback:
        raise ValueError(f"Need at least {lookback} rows to build a window, got {len(rows)}")
    feats = scalers.features.transform(rows[list(scalers.feature_cols)].to_numpy())
    target = scalers.target.transform(rows[[scalers.target_col]].to_numpy())[:, 0]
    # Each window ends on day t; its y value is that row's next-day target.
    X = np.stack([feats[i - lookback + 1 : i + 1] for i in range(lookback - 1, len(rows))])
    y = target[lookback - 1:]
    return X, y


def lag_matrix(
    part: pd.DataFrame,
    lookback: int = config.LOOKBACK,
    history: pd.DataFrame | None = None,
    column: str = "ret",
) -> np.ndarray:
    """Unscaled last-`lookback` values of one column, one row per aligned day.

    Used by the linear and logistic baselines, which take a flat row of lags
    instead of a sequence. Column j holds the value j days before the newest.
    """
    rows = with_history(part, history, lookback - 1)
    if len(rows) < lookback:
        raise ValueError(f"Need at least {lookback} rows to build lags, got {len(rows)}")
    values = rows[column].to_numpy()
    # Reverse each slice so column 0 is the newest return, matching model inputs.
    return np.stack([values[i - lookback + 1 : i + 1][::-1] for i in range(lookback - 1, len(rows))])


def direction_labels(
    part: pd.DataFrame, lookback: int = config.LOOKBACK, history: pd.DataFrame | None = None
) -> np.ndarray:
    """1.0 where the next day is up, else 0.0, aligned with make_windows' samples.

    A next-day return of exactly zero counts as not-up, matching
    evaluate.direction_accuracy.
    """
    return event_labels(part, lookback, history)


def event_labels(
    part: pd.DataFrame,
    lookback: int = config.LOOKBACK,
    history: pd.DataFrame | None = None,
    big_move: float | None = None,
) -> np.ndarray:
    """1.0 where the next-day event happens, aligned with make_windows' samples.

    With big_move=None the event is an up day. With a big_move threshold it
    is a big-move day: the next day's return moves more than the threshold
    in either direction.
    """
    target = aligned_rows(part, lookback, history)["target"].to_numpy()
    event = target > 0 if big_move is None else np.abs(target) > big_move
    return event.astype(float)
