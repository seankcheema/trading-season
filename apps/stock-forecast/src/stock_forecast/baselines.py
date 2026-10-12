"""Simple forecasts every model must beat before it earns its complexity."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from . import config
from .windows import with_history


def naive_returns(n: int) -> np.ndarray:
    """'Tomorrow's price = today's price', i.e. a predicted return of 0."""
    # A zero-return forecast is the main hurdle for any return model.
    return np.zeros(n)


def mean_returns(train: pd.DataFrame, n: int) -> np.ndarray:
    """Predict the average training-period daily return every day."""
    return np.full(n, float(train["target"].mean()))


def moving_average_returns(
    part: pd.DataFrame, window: int = config.MA_WINDOW, history: pd.DataFrame | None = None
) -> np.ndarray:
    """Predict tomorrow's return as the average of the last `window` returns.

    Uses returns up to and including today. With history, every row of part
    gets a value; without it, the first window - 1 values are NaN.
    """
    rows = with_history(part, history, window - 1)
    averages = rows["ret"].rolling(window).mean()
    return averages.iloc[-len(part):].to_numpy()


def always_up(n: int) -> np.ndarray:
    """Predict 'up' every day. Its accuracy is the share of up days."""
    # This exposes accuracy a model can get just by following the class balance.
    return np.ones(n, dtype=bool)


def fit_linear(X: np.ndarray, y: np.ndarray) -> LinearRegression:
    """Linear regression of tomorrow's return on the last LOOKBACK returns."""
    return LinearRegression().fit(X, y)


def fit_logistic(X: np.ndarray, y_up: np.ndarray) -> Pipeline:
    """Logistic regression predicting whether tomorrow is an up day.

    Scaling sits inside the pipeline, so it is fit on training rows only.
    """
    # The scaler is inside the estimator pipeline, so fit() sees training rows only.
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X, y_up)
