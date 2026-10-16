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
from .data import Splits, add_indicators, build_dataset, load_prices
from .evaluate import direction_metrics, event_metrics, score
from .lstm_model import (build_direction_lstm, build_lstm, load_artifacts, predict_returns, predict_up_probability,
                         train_lstm)
from .var_model import fit_var, one_step_forecasts, select_order
from .walk_forward import Fold
from .windows import Scalers, aligned_rows, event_labels, fit_scalers, lag_matrix, make_windows


@dataclass
class Prediction:
    """A model's output for one split: returns, up/down calls, or both."""

    returns: np.ndarray | None
    up: np.ndarray | None = None
    include_direction: bool = True
    prob_up: np.ndarray | None = None


def load_dataset() -> pd.DataFrame:
    """Load the saved AAPL and SPY snapshots and build the model dataset."""
    return build_dataset(load_prices(config.PRICES_CSV), load_prices(config.MARKET_CSV))


def load_direction_dataset() -> pd.DataFrame:
    """The model dataset plus the backward-looking indicators the direction models use."""
    return add_indicators(load_dataset())


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


@dataclass
class DirectionRun:
    """One trained event LSTM (direction or volatility) and its probabilities for the scored split.

    prob_up holds the event probability: P(up) for direction, P(big move) for volatility.
    """

    prob_up: np.ndarray
    model: object
    scalers: Scalers
    loss_history: dict
    lookback: int


def training_up_rate(train: pd.DataFrame) -> float:
    """Share of up days among the training labels that stay inside the training split."""
    # The last row's label is the next split's first day, so it is left out.
    return float((train.iloc[:-1]["target"] > 0).mean())


def direction_baselines(
    train: pd.DataFrame, part: pd.DataFrame, history: pd.DataFrame,
    feature_cols: tuple[str, ...] = tuple(config.DIRECTION_FEATURES),
) -> dict[str, np.ndarray]:
    """Up-probabilities from the simple direction models, for every day of part.

    The base rate is "always up" written as a probability. The two logistic
    regressions read today's indicator values and the last LOOKBACK returns.
    """
    fit_train = train.iloc[:-1]
    y_up = fit_train["target"].to_numpy() > 0
    probs = {"Always up (training up-rate)": np.full(len(part), training_up_rate(train))}
    cols = list(feature_cols)
    # Today's indicator row needs no history: every column already looks back.
    indicators = fit_logistic(fit_train[cols].to_numpy(), y_up)
    probs["Logistic regression (indicators)"] = indicators.predict_proba(part[cols].to_numpy())[:, 1]
    lags = fit_logistic(lag_matrix(fit_train), aligned_rows(fit_train)["target"].to_numpy() > 0)
    probs[f"Logistic regression ({config.LOOKBACK} returns)"] = lags.predict_proba(
        lag_matrix(part, history=history))[:, 1]
    return probs


def direction_lstm_predictions(
    train: pd.DataFrame,
    val: pd.DataFrame,
    part: pd.DataFrame,
    history: pd.DataFrame,
    feature_cols: tuple[str, ...] = tuple(config.DIRECTION_FEATURES),
    lookback: int = config.DIRECTION_LOOKBACK,
    units: int = config.DIRECTION_UNITS,
    seed: int = config.SEED,
    verbose: int = 0,
) -> DirectionRun:
    """Train a direction LSTM on train (early stopping on val); predict P(up) for each day of part."""
    return event_lstm_predictions(train, val, part, history, feature_cols, lookback, units, seed, verbose)


def event_lstm_predictions(
    train: pd.DataFrame,
    val: pd.DataFrame,
    part: pd.DataFrame,
    history: pd.DataFrame,
    feature_cols: tuple[str, ...],
    lookback: int,
    units: int,
    seed: int = config.SEED,
    verbose: int = 0,
    big_move: float | None = None,
) -> DirectionRun:
    """Train an LSTM classifier on train (early stopping on val); predict the event for each day of part.

    The event is an up day, or a big-move day when big_move is given (see
    windows.event_labels). The final row of train and of val carries a label
    from the next split, so neither label is fitted or used for early
    stopping. Those rows still feed the windows as past context, which leaks
    nothing.
    """
    fit_train, stop_val = train.iloc[:-1], val.iloc[:-1]
    scalers = fit_scalers(fit_train, feature_cols)
    X_train, _ = make_windows(fit_train, scalers, lookback)
    y_train = event_labels(fit_train, lookback, big_move=big_move)
    X_val, _ = make_windows(stop_val, scalers, lookback, history=train)
    y_val = event_labels(stop_val, lookback, history=train, big_move=big_move)
    assert X_train.shape == (len(y_train), lookback, len(feature_cols)), X_train.shape
    assert X_val.shape == (len(y_val), lookback, len(feature_cols)), X_val.shape
    model = build_direction_lstm(lookback, len(feature_cols), units, base_rate=float(y_train.mean()), seed=seed)
    loss_history = train_lstm(model, X_train, y_train, X_val, y_val, verbose=verbose)
    X_part, _ = make_windows(part, scalers, lookback, history=history)
    assert len(X_part) == len(part)
    return DirectionRun(predict_up_probability(model, X_part), model, scalers, loss_history, lookback)


def direction_row(name: str, actual: np.ndarray, prob_up: np.ndarray, base_rate: float, split: str) -> dict:
    """One results row for a direction model, in the results.csv layout plus direction metrics."""
    return {"model": name, "split": split, "days": int(len(actual)), "return_rmse": None,
            **direction_metrics(actual, prob_up, base_rate, config.DIRECTION_THRESHOLD)}


def direction_fold(fold: Fold, with_lstm: bool = False) -> list[dict]:
    """Walk-forward step for the direction models.

    The regressions fit on train + val, like classical_fold; the LSTM fits on
    train and early-stops on val. Brier skill uses one reference per year:
    the up-rate of everything before the test year.
    """
    seen = pd.concat([fold.train, fold.val])
    probs = direction_baselines(seen, fold.test, history=fold.val)
    if with_lstm:
        probs["LSTM direction"] = direction_lstm_predictions(fold.train, fold.val, fold.test, history=fold.val).prob_up
    actual = fold.test["target"].to_numpy()
    base_rate = training_up_rate(seen)
    return [direction_row(name, actual, p, base_rate, f"walk-forward {fold.year}") for name, p in probs.items()]


def big_move_threshold(train: pd.DataFrame) -> float:
    """The daily move size, up or down, above which a day counts as a big move.

    Cut at BIG_MOVE_QUANTILE of the training labels, leaving out the last
    one, which belongs to the next split. Reused unchanged on later splits.
    """
    return float(train.iloc[:-1]["target"].abs().quantile(config.BIG_MOVE_QUANTILE))


def big_move_days(part: pd.DataFrame, threshold: float) -> np.ndarray:
    """True where the next day's return is bigger than threshold in either direction."""
    return part["target"].abs().to_numpy() > threshold


def volatility_baselines(
    train: pd.DataFrame, part: pd.DataFrame, threshold: float,
    feature_cols: tuple[str, ...] = tuple(config.VOLATILITY_FEATURES),
) -> dict[str, np.ndarray]:
    """P(big move) from the simple volatility models, for every day of part.

    "Same as today" is the volatility version of the naive forecast: tomorrow
    is a big-move day if today was. The logistic regressions read today's
    values: the move size and 10-day volatility alone, then every indicator.
    """
    fit_train = train.iloc[:-1]
    y_big = big_move_days(fit_train, threshold)
    probs = {
        "Training big-move rate (constant)": np.full(len(part), float(y_big.mean())),
        "Same as today": (part["abs_ret"].to_numpy() > threshold).astype(float),
    }
    recent = ["abs_ret", f"volatility_{config.VOLATILITY_WINDOW}"]
    for name, cols in (("Logistic regression (recent volatility)", recent),
                       ("Logistic regression (indicators)", list(feature_cols))):
        model = fit_logistic(fit_train[cols].to_numpy(), y_big)
        probs[name] = model.predict_proba(part[cols].to_numpy())[:, 1]
    return probs


def volatility_lstm_predictions(
    train: pd.DataFrame,
    val: pd.DataFrame,
    part: pd.DataFrame,
    history: pd.DataFrame,
    threshold: float,
    feature_cols: tuple[str, ...] = tuple(config.VOLATILITY_FEATURES),
    lookback: int = config.VOLATILITY_LOOKBACK,
    units: int = config.VOLATILITY_UNITS,
    seed: int = config.SEED,
    verbose: int = 0,
) -> DirectionRun:
    """Train a volatility LSTM on train (early stopping on val); predict P(big move) for each day of part."""
    return event_lstm_predictions(train, val, part, history, feature_cols, lookback, units, seed, verbose,
                                  big_move=threshold)


def volatility_row(name: str, actual_big: np.ndarray, prob: np.ndarray, base_rate: float, split: str) -> dict:
    """One results row for a volatility model."""
    return {"model": name, "split": split, "days": int(len(actual_big)),
            **event_metrics(actual_big, prob, base_rate, config.DIRECTION_THRESHOLD)}


def volatility_fold(fold: Fold, with_lstm: bool = False) -> list[dict]:
    """Walk-forward step for the volatility models.

    The big-move threshold comes from the fold's training years, so the
    regressions (fit on train + val) and the LSTM (fit on train) predict the
    same event. Brier skill uses the big-move rate of everything before the
    test year.
    """
    threshold = big_move_threshold(fold.train)
    seen = pd.concat([fold.train, fold.val])
    probs = volatility_baselines(seen, fold.test, threshold)
    if with_lstm:
        probs["LSTM volatility"] = volatility_lstm_predictions(
            fold.train, fold.val, fold.test, history=fold.val, threshold=threshold).prob_up
    actual = big_move_days(fold.test, threshold)
    base_rate = float(big_move_days(seen.iloc[:-1], threshold).mean())
    return [{**volatility_row(name, actual, p, base_rate, f"walk-forward {fold.year}"), "threshold": threshold}
            for name, p in probs.items()]


def final_volatility_prediction(splits: Splits) -> tuple[str, np.ndarray, float]:
    """The saved volatility LSTM's P(big move) for the test split, and the threshold. Run this once.

    splits must come from load_direction_dataset().
    """
    model, scalers = load_artifacts(config.VOLATILITY_MODEL_DIR)
    lookback = int(model.input_shape[1])
    X_test, _ = make_windows(splits.test, scalers, lookback, history=splits.val)
    name = f"LSTM volatility ({len(scalers.feature_cols)} inputs, {lookback}-day window)"
    return name, predict_up_probability(model, X_test), big_move_threshold(splits.train)


def final_test_prediction(model_key: str, splits: Splits) -> tuple[str, Prediction]:
    """The chosen model's forecasts for the test split. Run this once.

    For "lstm-direction", splits must come from load_direction_dataset().
    """
    if model_key == "lstm-direction":
        model, scalers = load_artifacts(config.DIRECTION_MODEL_DIR)
        lookback = int(model.input_shape[1])
        X_test, _ = make_windows(splits.test, scalers, lookback, history=splits.val)
        prob = predict_up_probability(model, X_test)
        name = f"LSTM direction ({len(scalers.feature_cols)} inputs, {lookback}-day window)"
        return name, Prediction(None, prob > config.DIRECTION_THRESHOLD, prob_up=prob)
    if model_key == "lstm":
        # Load the frozen validation-selected model; never fit or tune on test rows.
        model, scalers = load_artifacts()
        X_test, _ = make_windows(splits.test, scalers, history=splits.val)
        return "LSTM", Prediction(predict_returns(model, X_test, scalers))
    preds, _ = classical_predictions(splits.train, splits.test, history=splits.val)
    prefix = {"var": "VAR(", "linear": "Linear regression"}[model_key]
    name = next(n for n in preds if n.startswith(prefix))
    return name, preds[name]
