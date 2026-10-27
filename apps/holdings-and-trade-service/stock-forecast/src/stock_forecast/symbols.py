"""Run the direction and volatility models on another stock with the settings chosen for AAPL.

Nothing is retuned per symbol: the point is to see whether the method, as
frozen for AAPL, carries over. When the symbol is the market itself (SPY),
the market columns are copies of its own returns, so they are dropped from
the inputs.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .data import add_indicators, build_dataset, load_prices, split_by_date
from .evaluate import direction_metrics, event_metrics
from .pipeline import (big_move_days, big_move_threshold, direction_baselines, direction_lstm_predictions,
                       training_up_rate, volatility_baselines, volatility_lstm_predictions)
from .walk_forward import walk_forward_folds

MARKET_COLUMNS = ("spy_ret", "spy_abs_ret")


def load_symbol_dataset(symbol: str) -> pd.DataFrame:
    """The indicator dataset with `symbol` as the stock to predict and SPY as the market."""
    if symbol not in config.SYMBOL_CSVS:
        raise ValueError(f"No saved snapshot for {symbol}; known symbols: {sorted(config.SYMBOL_CSVS)}")
    return add_indicators(build_dataset(load_prices(config.SYMBOL_CSVS[symbol]), load_prices(config.MARKET_CSV)))


def inputs_for(symbol: str, features: list[str]) -> tuple[str, ...]:
    """The feature list, minus market columns when the symbol is the market itself."""
    if symbol == config.MARKET_TICKER:
        return tuple(c for c in features if c not in MARKET_COLUMNS)
    return tuple(features)


def _rows(symbol: str, task: str, split: str, probs: dict[str, np.ndarray], actual: np.ndarray,
          base_rate: float, bar: float) -> list[dict]:
    rows = []
    for model, prob in probs.items():
        if task == "direction":
            m = direction_metrics(actual, prob, base_rate, config.DIRECTION_THRESHOLD)
            accuracy = m["direction_accuracy"]
        else:
            m = event_metrics(actual, prob, base_rate, config.DIRECTION_THRESHOLD)
            accuracy = m["accuracy"]
        rows.append({"symbol": symbol, "task": task, "split": split, "model": model, "days": int(len(actual)),
                     "accuracy": accuracy, "bar_to_clear": bar, "auc": m["auc"], "brier_skill": m["brier_skill"]})
    return rows


def _direction(symbol, train, part, history, lstm_train, lstm_val, split, with_lstm):
    """Direction rows for one scored period. lstm_* are the LSTM's own fit and early-stopping parts."""
    cols = inputs_for(symbol, config.DIRECTION_FEATURES)
    probs = direction_baselines(train, part, history=history, feature_cols=cols)
    probs = {k: v for k, v in probs.items() if "30 returns" not in k}
    if with_lstm:
        probs["LSTM direction"] = direction_lstm_predictions(lstm_train, lstm_val, part, history=history,
                                                             feature_cols=cols).prob_up
    actual = part["target"].to_numpy()
    # The bar to clear is "always up", scored on the same days.
    return _rows(symbol, "direction", split, probs, actual, training_up_rate(train), float((actual > 0).mean()))


def _volatility(symbol, train, part, history, lstm_train, lstm_val, split, with_lstm):
    cols = inputs_for(symbol, config.VOLATILITY_FEATURES)
    # One threshold, cut from the LSTM's training years, defines the event for every model in this period.
    threshold = big_move_threshold(lstm_train)
    probs = volatility_baselines(train, part, threshold, feature_cols=cols)
    probs = {k: v for k, v in probs.items() if k in ("Logistic regression (indicators)",)}
    if with_lstm:
        probs["LSTM volatility"] = volatility_lstm_predictions(lstm_train, lstm_val, part, history=history,
                                                               threshold=threshold, feature_cols=cols).prob_up
    actual = big_move_days(part, threshold)
    base_rate = float(big_move_days(train.iloc[:-1], threshold).mean())
    # The bar to clear is the better of answering "big" or "calm" every day.
    return _rows(symbol, "volatility", split, probs, actual, base_rate, float(max(actual.mean(), 1 - actual.mean())))


def symbol_rows(symbol: str, with_lstm: bool = True) -> list[dict]:
    """Validation and walk-forward rows for both tasks on one symbol. Never reads the test years."""
    dataset = load_symbol_dataset(symbol)
    splits = split_by_date(dataset)
    rows = (_direction(symbol, splits.train, splits.val, splits.train, splits.train, splits.val,
                       "validation", with_lstm)
            + _volatility(symbol, splits.train, splits.val, splits.train, splits.train, splits.val,
                          "validation", with_lstm))
    for fold in walk_forward_folds(dataset):
        # Regressions fit on train + val, the LSTM on train with val for early stopping, as elsewhere.
        seen = pd.concat([fold.train, fold.val])
        split = f"walk-forward {fold.year}"
        rows += _direction(symbol, seen, fold.test, fold.val, fold.train, fold.val, split, with_lstm)
        rows += _volatility(symbol, seen, fold.test, fold.val, fold.train, fold.val, split, with_lstm)
    return rows


def merge_results(saved: pd.DataFrame | None, new: pd.DataFrame,
                  keys: tuple[str, ...] = ("symbol", "model")) -> pd.DataFrame:
    """Replace the saved rows of each key combination just run; keep every other row.

    With the default keys, a quick --no-lstm run of one symbol keeps that
    symbol's saved LSTM rows.
    """
    if saved is None or saved.empty:
        return new.reset_index(drop=True)
    rerun = set(zip(*(new[k] for k in keys)))
    kept = saved[[combo not in rerun for combo in zip(*(saved[k] for k in keys))]]
    return pd.concat([kept, new], ignore_index=True)


def summarise(table: pd.DataFrame) -> pd.DataFrame:
    """Walk-forward average accuracy, bar, years beating the bar and Brier skill, per symbol, task and model."""
    wf = table[table["split"].str.startswith("walk-forward")].copy()
    wf["beat"] = wf["accuracy"] > wf["bar_to_clear"]
    out = wf.groupby(["symbol", "task", "model"], sort=False).agg(
        accuracy=("accuracy", "mean"), bar_to_clear=("bar_to_clear", "mean"), worst_year=("accuracy", "min"),
        years_beating_bar=("beat", "sum"), years=("beat", "size"), brier_skill=("brier_skill", "mean"))
    val = table[table["split"] == "validation"].set_index(["symbol", "task", "model"])["accuracy"]
    out.insert(0, "validation_accuracy", val)
    return out.reset_index()
