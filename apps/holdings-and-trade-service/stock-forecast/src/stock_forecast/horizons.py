"""Big-move models over longer prediction windows, and over a sliding training window.

The label for day t is whether realized volatility over days t+1..t+H (the
root mean square of those daily returns) is above its median in the fitting
years. For H = 1 that is the next-day big move. Labels look ahead by up to H
days, so the last H labels before every split boundary are dropped from
fitting and early stopping (the purge). Optionally, training uses only the
last N years before each validation year instead of all history.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .baselines import fit_logistic
from .pipeline import event_lstm_predictions
from .symbols import _rows, inputs_for
from .vix_family import vix_family_dataset
from .walk_forward import walk_forward_folds


def future_volatility(returns: pd.Series, horizon: int) -> pd.Series:
    """Realized volatility over the next `horizon` days: sqrt(mean of r(t+1)^2 .. r(t+H)^2).

    This is a label, so it looks ahead by design; it is never a model input.
    The last `horizon` days have no complete window and are NaN.
    """
    if horizon < 1:
        raise ValueError(f"horizon must be at least 1, got {horizon}")
    squared = returns.pow(2).to_numpy()
    out = np.full(len(squared), np.nan)
    sums = np.concatenate([[0.0], np.cumsum(squared)])
    for i in range(len(squared) - horizon):
        out[i] = np.sqrt((sums[i + 1 + horizon] - sums[i + 1]) / horizon)
    return pd.Series(out, index=returns.index, name=f"future_vol_{horizon}")


def horizon_dataset(symbol: str, horizon: int) -> pd.DataFrame:
    """The VIX-family dataset with `target` replaced by the H-day realized volatility label."""
    data = vix_family_dataset(symbol)
    data["target"] = future_volatility(data["ret"], horizon)
    return data.dropna(subset=["target"])


def horizon_rows(symbol: str, horizon: int, with_lstm: bool = True, train_years: int | None = None,
                 verbose: int = 0) -> list[dict]:
    """Walk-forward rows for one symbol and prediction window. Never reads the test years."""
    cols = inputs_for(symbol, config.HORIZON_FEATURES)
    window = "all history" if train_years is None else f"last {train_years} years"
    rows = []
    for fold in walk_forward_folds(horizon_dataset(symbol, horizon)):
        train = fold.train if train_years is None else fold.train.loc[f"{fold.year - 1 - train_years}-01-01":]
        fit = pd.concat([train, fold.val]).iloc[:-horizon]
        # One threshold per fold, from the LSTM's fitting rows, defines "more volatile than usual".
        threshold = float(train.iloc[:-horizon]["target"].median())
        probs = {"Logistic regression": fit_logistic(fit[list(cols)].to_numpy(), fit["target"].to_numpy() > threshold)
                 .predict_proba(fold.test[list(cols)].to_numpy())[:, 1]}
        if with_lstm:
            print(f"[walk-forward {fold.year}] {symbol}, {horizon}-day window, {window}: training LSTM", flush=True)
            probs["LSTM"] = event_lstm_predictions(
                train, fold.val, fold.test, history=fold.val, feature_cols=cols,
                lookback=config.VOLATILITY_LOOKBACK, units=config.VOLATILITY_UNITS, verbose=verbose,
                big_move=threshold, purge=horizon).prob_up
        probs["Average of both"] = np.mean(list(probs.values()), axis=0) if with_lstm else None
        probs = {k: v for k, v in probs.items() if v is not None}
        actual = fold.test["target"].to_numpy() > threshold
        base_rate = float((fit["target"] > threshold).mean())
        for row in _rows(symbol, "volatility", f"walk-forward {fold.year}", probs, actual, base_rate,
                         float(max(actual.mean(), 1 - actual.mean()))):
            rows.append({**row, "horizon_days": horizon, "training_window": window})
    return rows
