"""Vector autoregression (VAR), estimated by ordinary least squares.

A VAR(p) forecasts every column from the last p values of every column:

    y[t+1] = c + A1 @ y[t] + A2 @ y[t-1] + ... + Ap @ y[t-p+1] + noise

Here y is [AAPL return, SPY return, AAPL volume change]; we read off the
AAPL component as the return forecast. See textbook Chapter08, notebook
03_vector_autoregressive_model.ipynb, for the statsmodels version of the same
model; this one is written out in numpy so every step is visible and tested.
All columns must be stationary (returns and changes are; prices are not).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config
from .windows import with_history


@dataclass
class VARResult:
    """A fitted VAR. coefs[i] is the k x k matrix applied to the value i + 1 days back."""

    columns: tuple[str, ...]
    order: int
    intercept: np.ndarray
    coefs: np.ndarray
    residual_cov: np.ndarray
    n_obs: int


def lag_design(values: np.ndarray, order: int) -> tuple[np.ndarray, np.ndarray]:
    """Build the regression inputs Z and outputs Y for a VAR(order).

    Row r of Y is the observation at time t = order + r. Row r of Z is
    [1, y[t-1], y[t-2], ..., y[t-order]], each y a block of k values.
    """
    T, _ = values.shape
    if T <= order:
        raise ValueError(f"Need more than {order} observations for a VAR({order}), got {T}")
    # Regress each current row on a constant and the requested past rows.
    Y = values[order:]
    lags = [values[order - j : T - j] for j in range(1, order + 1)]
    Z = np.hstack([np.ones((T - order, 1))] + lags)
    return Z, Y


def fit_var(data: pd.DataFrame, order: int) -> VARResult:
    """Estimate a VAR(order) on the rows of data by least squares."""
    values = data.to_numpy(dtype=float)
    k = values.shape[1]
    Z, Y = lag_design(values, order)
    # Least squares estimates all output series together from the same lag matrix.
    B, *_ = np.linalg.lstsq(Z, Y, rcond=None)
    resid = Y - Z @ B
    coefs = np.stack([B[1 + j * k : 1 + (j + 1) * k].T for j in range(order)])
    return VARResult(
        columns=tuple(data.columns),
        order=order,
        intercept=B[0].copy(),
        coefs=coefs,
        residual_cov=resid.T @ resid / len(Y),
        n_obs=len(Y),
    )


def information_criterion(result: VARResult) -> float:
    """Akaike information criterion: fit quality minus a penalty per coefficient. Lower is better."""
    k = len(result.columns)
    _, logdet = np.linalg.slogdet(result.residual_cov)
    return float(logdet + 2 * result.order * k * k / result.n_obs)


def select_order(data: pd.DataFrame, max_order: int = config.VAR_MAX_LAGS) -> int:
    """Choose the VAR order between 1 and max_order with the lowest AIC.

    Every candidate is fit on the same rows (the first max_order are held back
    as lags), so their AIC values are comparable.
    """
    # Hold back the same leading rows for every candidate so AIC compares like with like.
    scores = {p: information_criterion(fit_var(data.iloc[max_order - p:], p)) for p in range(1, max_order + 1)}
    return min(scores, key=scores.get)


def forecast_next(result: VARResult, recent: np.ndarray) -> np.ndarray:
    """Forecast the next observation from the last `order` rows (oldest first)."""
    forecast = result.intercept.copy()
    # coefs[0] multiplies the newest observation, coefs[1] the prior one, and so on.
    for i in range(result.order):
        forecast = forecast + result.coefs[i] @ recent[-1 - i]
    return forecast


def one_step_forecasts(
    result: VARResult, part: pd.DataFrame, history: pd.DataFrame | None = None
) -> np.ndarray:
    """Forecast day t+1 for each day t in part, using only rows up to t.

    Returns shape (rows, k). With history, every row of part gets a forecast;
    without it, the first order - 1 rows are only used as lags.
    """
    cols = list(result.columns)
    rows = with_history(part[cols], None if history is None else history[cols], result.order - 1)
    values = rows.to_numpy(dtype=float)
    if len(values) < result.order:
        raise ValueError(f"Need at least {result.order} rows to forecast, got {len(values)}")
    return np.array([
        forecast_next(result, values[i - result.order + 1 : i + 1])
        for i in range(result.order - 1, len(values))
    ])
