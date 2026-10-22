"""One volatility LSTM trained on several stocks at once, and the VIX experiment.

Each stock keeps its own big-move threshold and its own input scalers, both
fit on that stock's training rows, so a "big move" means the same thing
relative to each stock's normal day. The windows of all stocks are then
pooled to train one model, which is scored on each stock separately.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .data import add_vix, load_prices, split_by_date
from .lstm_model import build_direction_lstm, predict_up_probability, train_lstm
from .pipeline import big_move_days, big_move_threshold, volatility_baselines, volatility_lstm_predictions
from .symbols import _rows, inputs_for, load_symbol_dataset
from .walk_forward import walk_forward_folds
from .windows import aligned_rows, event_labels, fit_scalers, make_windows

Period = tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]  # train, val, part, history


def pooled_volatility_predictions(
    periods: dict[str, Period],
    feature_cols: tuple[str, ...],
    lookback: int = config.VOLATILITY_LOOKBACK,
    units: int = config.VOLATILITY_UNITS,
    seed: int = config.SEED,
    verbose: int = 0,
    purge: int = 1,
    label: str | None = None,
) -> dict[str, np.ndarray]:
    """Train one LSTM on every stock's training windows; return P(big move) for each stock's part.

    As in pipeline.event_lstm_predictions, the last `purge` training and
    validation labels, which reach into the next split (1 for a next-day
    label, H for a label over the next H days), are never fitted or used to
    stop. The event is a target beyond the stock's big-move threshold, or,
    with `label`, that boolean column of the rows, so a model can be fit on
    exactly the question it will be scored on.
    """
    if purge < 1:
        raise ValueError(f"purge must be at least 1, got {purge}")
    X_train, y_train, X_val, y_val, prepared = [], [], [], [], {}
    for symbol, (train, val, part, history) in periods.items():
        fit_train, stop_val = train.iloc[:-purge], val.iloc[:-purge]
        threshold = big_move_threshold(train)
        scalers = fit_scalers(fit_train, feature_cols)  # per stock, training rows only
        X, _ = make_windows(fit_train, scalers, lookback)
        Xv, _ = make_windows(stop_val, scalers, lookback, history=train)
        X_train.append(X)
        y_train.append(_labels(fit_train, lookback, None, threshold, label))
        X_val.append(Xv)
        y_val.append(_labels(stop_val, lookback, train, threshold, label))
        prepared[symbol] = (scalers, part, history)
    X_train, y_train = np.concatenate(X_train), np.concatenate(y_train)
    X_val, y_val = np.concatenate(X_val), np.concatenate(y_val)
    model = build_direction_lstm(lookback, len(feature_cols), units, base_rate=float(y_train.mean()), seed=seed)
    train_lstm(model, X_train, y_train, X_val, y_val, verbose=verbose)
    probs = {}
    for symbol, (scalers, part, history) in prepared.items():
        X_part, _ = make_windows(part, scalers, lookback, history=history)
        assert len(X_part) == len(part)
        probs[symbol] = predict_up_probability(model, X_part)
    return probs


def _labels(part, lookback, history, threshold, label) -> np.ndarray:
    """The window-aligned 0/1 labels: the big-move event, or the rows' own `label` column."""
    if label is None:
        return event_labels(part, lookback, history=history, big_move=threshold)
    return aligned_rows(part, lookback, history)[label].to_numpy().astype(float)


def vix_dataset(symbol: str) -> pd.DataFrame:
    return add_vix(load_symbol_dataset(symbol), load_prices(config.VIX_CSV))


def _progress(message: str) -> None:
    print(message, flush=True)  # flush so a log followed with tail -f updates at once


def _per_stock(symbol, train, part, history, lstm_train, lstm_val, split, verbose=0) -> list[dict]:
    """Per-stock models with and without VIX, all predicting the same big-move event."""
    threshold = big_move_threshold(lstm_train)
    current = inputs_for(symbol, config.VOLATILITY_FEATURES)
    with_vix = inputs_for(symbol, config.VIX_FEATURES)
    probs = {}
    for label, cols in (("", current), (" + VIX", with_vix)):
        baselines = volatility_baselines(train, part, threshold, feature_cols=cols)
        probs[f"Logistic regression{label}"] = baselines["Logistic regression (indicators)"]
        _progress(f"[{split}] {symbol}: training LSTM, one stock{label}")
        probs[f"LSTM, one stock{label}"] = volatility_lstm_predictions(
            lstm_train, lstm_val, part, history=history, threshold=threshold, feature_cols=cols,
            verbose=verbose).prob_up
    actual = big_move_days(part, threshold)
    base_rate = float(big_move_days(train.iloc[:-1], threshold).mean())
    return _rows(symbol, "volatility", split, probs, actual, base_rate, float(max(actual.mean(), 1 - actual.mean())))


def _pooled(periods: dict[str, Period], split: str, verbose: int = 0) -> list[dict]:
    rows = []
    preds = {}
    for label, cols in (("", config.VOLATILITY_FEATURES), (" + VIX", config.VIX_FEATURES)):
        _progress(f"[{split}] all stocks: training LSTM, all stocks{label}")
        preds[label] = pooled_volatility_predictions(periods, tuple(cols), verbose=verbose)
    for symbol, (train, val, part, history) in periods.items():
        threshold = big_move_threshold(train)
        actual = big_move_days(part, threshold)
        # Same reference rate as the per-stock rows: the regressions' fitting rows.
        fit_rows = pd.concat([train, val]) if split.startswith("walk-forward") else train
        base_rate = float(big_move_days(fit_rows.iloc[:-1], threshold).mean())
        probs = {f"LSTM, all stocks{label}": p[symbol] for label, p in preds.items()}
        rows += _rows(symbol, "volatility", split, probs, actual, base_rate,
                      float(max(actual.mean(), 1 - actual.mean())))
    return rows


def pooled_vix_rows(symbols: list[str] = config.COMPARISON_SYMBOLS, verbose: int = 0) -> list[dict]:
    """Validation and walk-forward rows for every model variant and stock. Never reads the test years.

    Prints one progress line per model trained; verbose=2 also prints one line per epoch.
    """
    datasets = {symbol: vix_dataset(symbol) for symbol in symbols}
    splits = {symbol: split_by_date(d) for symbol, d in datasets.items()}
    rows = []
    for symbol, s in splits.items():
        rows += _per_stock(symbol, s.train, s.val, s.train, s.train, s.val, "validation", verbose)
    rows += _pooled({sym: (s.train, s.val, s.val, s.train) for sym, s in splits.items()}, "validation", verbose)
    folds = {symbol: {f.year: f for f in walk_forward_folds(d)} for symbol, d in datasets.items()}
    for year in config.WALK_FORWARD_YEARS:
        split = f"walk-forward {year}"
        for symbol in symbols:
            f = folds[symbol][year]
            rows += _per_stock(symbol, pd.concat([f.train, f.val]), f.test, f.val, f.train, f.val, split, verbose)
        rows += _pooled({sym: (folds[sym][year].train, folds[sym][year].val, folds[sym][year].test,
                               folds[sym][year].val) for sym in symbols}, split, verbose)
    return rows
