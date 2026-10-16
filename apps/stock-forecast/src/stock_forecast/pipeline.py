"""Glue between the modules: the steps the numbered scripts run.

Every model is scored on the same days. `history` is always the split just
before `part`, so the first days of `part` still get a full window of past
data without any future data leaking in.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config
from .baselines import always_up, fit_linear, fit_logistic, mean_returns, moving_average_returns, naive_returns
from .data import Splits, build_dataset, load_prices
from .evaluate import score
from .lstm_model import build_lstm, load_artifacts, predict_returns, train_lstm
from .var_model import fit_var, one_step_forecasts, select_order
from .walk_forward import Fold
from .windows import Scalers, aligned_rows, fit_scalers, lag_matrix, make_windows


@dataclass
class Prediction:
    """A model's output for one split: returns, up/down calls, or both."""

    returns: np.ndarray | None
    up: np.ndarray | None = None
    include_direction: bool = True


def load_dataset() -> pd.DataFrame:
    """Load the saved AAPL and SPY snapshots and build the model dataset."""
    return build_dataset(load_prices(config.PRICES_CSV), load_prices(config.MARKET_CSV))


def classical_predictions(
    train: pd.DataFrame, part: pd.DataFrame, history: pd.DataFrame, include_var: bool = True
) -> tuple[dict[str, Prediction], dict]:
    """Fit every non-neural model on train and forecast each day of part."""
    n = len(part)
    # The final training row's target belongs to the first day in part. Keep
    # that row as history, but never use its cross-boundary label to fit.
    fit_train = train.iloc[:-1]
    # Keep simple baselines beside learned models so each score has context.
    preds: dict[str, Prediction] = {
        "Naive (return = 0)": Prediction(naive_returns(n), include_direction=False),
        "Always up": Prediction(None, always_up(n)),
        "Training-average return": Prediction(mean_returns(fit_train, n)),
        f"{config.MA_WINDOW}-day average return": Prediction(moving_average_returns(part, history=history)),
    }

    # Training features and labels align after removing rows without a full lookback.
    X_train = lag_matrix(fit_train)
    y_train = aligned_rows(fit_train)["target"].to_numpy()
    # Past-split history fills the first window without using future rows.
    X_part = lag_matrix(part, history=history)
    preds["Linear regression"] = Prediction(fit_linear(X_train, y_train).predict(X_part))
    preds["Logistic regression"] = Prediction(None, fit_logistic(X_train, y_train > 0).predict(X_part).astype(bool))

    # Baseline scoring ends here; VAR remains available to the other workflows.
    if not include_var:
        return preds, {"var_order": None}

    try:
        order = select_order(train[config.VAR_COLUMNS])
        var = fit_var(train[config.VAR_COLUMNS], order)
    except NotImplementedError:
        # Starter version: var_model.py is written after the week-1 baselines.
        warnings.warn("VAR skipped: var_model.py is not implemented yet", stacklevel=2)
        return preds, {"var_order": None}
    forecasts = one_step_forecasts(var, part, history)
    preds[f"VAR({order})"] = Prediction(forecasts[:, var.columns.index("ret")])
    return preds, {"var_order": order}


def score_all(preds: dict[str, Prediction], actual: np.ndarray, split: str) -> list[dict]:
    """Score every prediction against the same actual returns."""
    return [
        score(name, actual, p.returns, p.up, split=split, include_direction=p.include_direction)
        for name, p in preds.items()
    ]


def lstm_predictions(
    train: pd.DataFrame,
    val: pd.DataFrame,
    part: pd.DataFrame,
    history: pd.DataFrame,
    feature_cols: tuple[str, ...] = ("ret",),
    verbose: int = 0,
):
    """Train an LSTM on train (early stopping on val) and forecast each day of part.

    Returns (predicted returns, model, scalers, loss history). verbose=2 prints one line per epoch.
    """
    # Reuse one training-only scaler pair for train, validation, and forecasts.
    scalers = fit_scalers(train, feature_cols)
    X_train, y_train = make_windows(train, scalers)
    X_val, y_val = make_windows(val, scalers, history=train)
    model = build_lstm(n_features=len(feature_cols))
    loss_history = train_lstm(model, X_train, y_train, X_val, y_val, verbose=verbose)
    X_part, _ = make_windows(part, scalers, history=history)
    return predict_returns(model, X_part, scalers), model, scalers, loss_history


def classical_fold(fold: Fold) -> list[dict]:
    """Walk-forward step for the non-neural models (they fit on train + val)."""
    preds, info = classical_predictions(pd.concat([fold.train, fold.val]), fold.test, history=fold.val)
    rows = score_all(preds, fold.test["target"].to_numpy(), split=f"walk-forward {fold.year}")
    for row in rows:
        if row["model"].startswith("VAR("):
            row["model"] = "VAR"  # the chosen order can differ by year; keep one line per model
            row["var_order"] = info["var_order"]
    return rows


def lstm_fold(fold: Fold) -> list[dict]:
    """Walk-forward step for the LSTM."""
    predicted, *_ = lstm_predictions(fold.train, fold.val, fold.test, history=fold.val)
    return [score("LSTM", fold.test["target"].to_numpy(), predicted, split=f"walk-forward {fold.year}")]


def final_test_prediction(model_key: str, splits: Splits) -> tuple[str, Prediction]:
    """The chosen model's forecasts for the test split. Run this once."""
    if model_key == "lstm":
        # Load the frozen validation-selected model; never fit or tune on test rows.
        model, scalers = load_artifacts()
        X_test, _ = make_windows(splits.test, scalers, history=splits.val)
        return "LSTM", Prediction(predict_returns(model, X_test, scalers))
    preds, _ = classical_predictions(splits.train, splits.test, history=splits.val)
    prefix = {"var": "VAR(", "linear": "Linear regression"}[model_key]
    name = next(n for n in preds if n.startswith(prefix))
    return name, preds[name]
