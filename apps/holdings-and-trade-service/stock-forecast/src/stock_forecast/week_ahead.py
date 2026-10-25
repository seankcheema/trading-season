"""Week-ahead risk: will the market's realized volatility over the next H days be above its usual level?

This is the question of `horizons.py` with one symbol, one window and one
model frozen for a single pre-registered test (PREREGISTRATION_WEEK_AHEAD.md).
The label for day t is whether the realized volatility of days t+1..t+H is
above the median of that label over the training rows. The model is the
logistic regression of the horizon study on `HORIZON_FEATURES`, fit on
training and validation rows with the last H labels before the scored period
dropped (the purge), exactly as in its walk-forward.

Two bars are scored on the same days: one answer every day (the better of
"stormier" and "calmer", chosen in hindsight, so it flatters the bar) and the
rule "same as the last H days", which calls stormier when the realized
volatility of days t-H+1..t is above the same threshold.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .baselines import fit_logistic
from .evaluate import event_confidence_buckets, event_metrics
from .horizons import horizon_dataset
from .symbols import inputs_for
from .walk_forward import walk_forward_folds

MODEL = "Logistic regression"
RULE = "Same as the last days"


def past_volatility(returns: pd.Series, horizon: int) -> pd.Series:
    """Realized volatility over the last `horizon` days including today: sqrt(mean of r(t-H+1)^2 .. r(t)^2).

    Known at day t's close, so it may be used as a forecast. The first
    `horizon - 1` days have no complete window and are NaN.
    """
    if horizon < 1:
        raise ValueError(f"horizon must be at least 1, got {horizon}")
    return returns.pow(2).rolling(horizon).mean().pow(0.5).rename(f"past_vol_{horizon}")


def week_ahead_dataset(symbol: str = config.WEEK_AHEAD_SYMBOL,
                       horizon: int = config.WEEK_AHEAD_HORIZON) -> pd.DataFrame:
    """The horizon study's dataset for `symbol` and `horizon`, with the rule's input column added."""
    data = horizon_dataset(symbol, horizon)
    data["past_vol"] = past_volatility(data["ret"], horizon)
    return data


def score_period(symbol: str, train: pd.DataFrame, val: pd.DataFrame, scored: pd.DataFrame, horizon: int,
                 split: str) -> tuple[list[dict], np.ndarray, np.ndarray]:
    """Fit on `train` and `val`, score `scored`; returns the rows, the model's probabilities and the outcomes.

    The threshold comes from training labels only, and the last `horizon`
    labels before `scored` are left out of the fit because they reach into it.

    Raises:
        ValueError: if a period is empty or the rule has no complete window on a scored day.
    """
    for name, part in (("train", train), ("validation", val), ("scored", scored)):
        if len(part) <= horizon:
            raise ValueError(f"{split}: the {name} part has {len(part)} rows, need more than {horizon}")
    if scored["past_vol"].isna().any():
        raise ValueError(f"{split}: the rule has no complete {horizon}-day window on some scored days")
    cols = list(inputs_for(symbol, config.HORIZON_FEATURES))
    threshold = float(train.iloc[:-horizon]["target"].median())
    fit = pd.concat([train, val]).iloc[:-horizon]
    prob = fit_logistic(fit[cols].to_numpy(), fit["target"].to_numpy() > threshold).predict_proba(
        scored[cols].to_numpy())[:, 1]
    actual = scored["target"].to_numpy() > threshold
    base_rate = float((fit["target"] > threshold).mean())
    one_answer = float(max(actual.mean(), 1 - actual.mean()))
    probs = {MODEL: prob, RULE: (scored["past_vol"].to_numpy() > threshold).astype(float)}
    metrics = {name: event_metrics(actual, p, base_rate, config.DIRECTION_THRESHOLD) for name, p in probs.items()}
    rows = [{"symbol": symbol, "horizon_days": horizon, "split": split, "model": name,
             "first_day": str(scored.index.min().date()), "last_day": str(scored.index.max().date()),
             "days": int(len(actual)), "accuracy": m["accuracy"], "one_answer_bar": one_answer,
             "rule_accuracy": metrics[RULE]["accuracy"], "auc": m["auc"], "brier_skill": m["brier_skill"],
             "call_rate": m["call_rate"], "event_rate": m["event_rate"], "threshold": threshold}
            for name, m in metrics.items()]
    return rows, prob, actual


def walk_forward_rows(symbol: str = config.WEEK_AHEAD_SYMBOL,
                      horizon: int = config.WEEK_AHEAD_HORIZON) -> pd.DataFrame:
    """One row per walk-forward year and model. Never reads the test years."""
    data = week_ahead_dataset(symbol, horizon).loc[:config.VAL_END]
    rows = []
    for fold in walk_forward_folds(data):
        rows += score_period(symbol, fold.train, fold.val, fold.test, horizon, f"walk-forward {fold.year}")[0]
    return pd.DataFrame(rows)


def final_test_period(symbol: str = config.WEEK_AHEAD_SYMBOL, horizon: int = config.WEEK_AHEAD_HORIZON
                ) -> tuple[pd.DataFrame, pd.DataFrame]:
    """The one pre-registered test: fit on 2010-2023, score from TEST_START to the last complete window.

    Returns the result rows and the model's accuracy by confidence bucket.
    """
    data = week_ahead_dataset(symbol, horizon)
    rows, prob, actual = score_period(symbol, data.loc[:config.TRAIN_END], data.loc[config.VAL_START:config.VAL_END],
                                      data.loc[config.TEST_START:], horizon, "test")
    buckets = event_confidence_buckets(actual, prob, config.CONFIDENCE_BUCKETS, config.DIRECTION_THRESHOLD)
    return pd.DataFrame(rows), buckets


def most_confident(buckets: pd.DataFrame, top: int) -> tuple[float, float]:
    """Accuracy and share of days over the `top` most confident buckets (the last rows of `buckets`)."""
    if not 1 <= top <= len(buckets):
        raise ValueError(f"top must be between 1 and {len(buckets)}, got {top}")
    chosen = buckets.tail(top)
    days = chosen["days"].sum()
    return float((chosen["accuracy"] * chosen["days"]).sum() / days), float(days / buckets["days"].sum())
