"""Will the next H days be more volatile than usual? The platform question at a longer horizon.

The next-day question (platform_calibration.py) is mostly noise: within one
of the simulation's regimes every day's return is an independent draw, so
whether tomorrow beats the median is a coin flip. Over several days the
noise averages out and what is left is the regime, which lasts weeks. The
label for day t is the realized volatility of days t+1..t+H
(horizons.future_volatility) against its usual level: the median, over the
PLATFORM_CALIBRATION_MIN_DAYS days to t, of the realized volatility of the
last H days, all known at t.

Every row is indexed by the day the forecast is made. Labels look ahead H
days, so the last H days before a scored month are left out of every fit
(the purge), as in horizons.py. Variants:

- Recent volatility, platform fit: a logistic regression on today's move,
  10-day volatility and the last H days' volatility, fit on earlier days.
- LSTM trained on the platform: one model for every symbol, fit on the days to
  PLATFORM_LSTM_TRAIN_END with the same purge, scored on the later months.
  Its score is also passed through a logistic mapping fit on the symbol's
  earlier scored days ("calibrated": the ranking is kept, the 0.5 call line
  moves to where those days put it).
- One answer every day, and "same as the last H days": the rules a client
  could follow without a model.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from . import config
from .horizons import future_volatility
from .platform_calibration import ONE_ANSWER, PERSISTENCE, PLATFORM_LSTM, _fit_or_constant, _logit, _progress
from .data import add_range_features
from .platform_demo import load_platform_prices, platform_dataset

SAME_AS_LAST = "Same as the last H days"
RULES = (ONE_ANSWER, SAME_AS_LAST)
CALIBRATED = " (calibrated)"
OWN_MEDIAN = " (own median)"
STACKED = " + pattern (stacked)"


def past_volatility(returns: pd.Series, horizon: int) -> pd.Series:
    """Realized volatility of the last `horizon` days including today: known at today's close."""
    return returns.pow(2).rolling(horizon).mean().pow(0.5)


def horizon_daily(data: pd.DataFrame, horizon: int, window: int = config.PLATFORM_CALIBRATION_MIN_DAYS) -> pd.DataFrame:
    """One row per forecast day: the label, its usual level and the features known at that close."""
    if horizon < 1:
        raise ValueError(f"horizon must be at least 1, got {horizon}")
    past = past_volatility(data["ret"], horizon)
    daily = pd.DataFrame({
        "target": future_volatility(data["ret"], horizon),
        "past": past,
        "usual": past.rolling(window).median(),
        **{col: data[col] for col in config.PLATFORM_PERSISTENCE_FEATURES},
    }, index=data.index)
    daily = daily.dropna(subset=["usual", "past"])
    daily["big"] = daily["target"] > daily["usual"]
    return daily


def horizon_probabilities(trailing: pd.DataFrame, part: pd.DataFrame) -> dict[str, np.ndarray]:
    """Each variant's P(more volatile than usual) for the days of part, fit on trailing only."""
    y_fit = trailing["big"].to_numpy()
    base = float(y_fit.mean())
    feats = [*config.PLATFORM_PERSISTENCE_FEATURES, "past"]
    return {
        PERSISTENCE: _fit_or_constant(trailing[feats].to_numpy(), y_fit, part[feats].to_numpy(), base),
        ONE_ANSWER: np.full(len(part), float(base >= 0.5)),
        SAME_AS_LAST: (part["past"].to_numpy() > part["usual"].to_numpy()).astype(float),
    }


def horizon_rows(
    daily: pd.DataFrame, symbol: str, horizon: int, min_days: int = config.PLATFORM_CALIBRATION_MIN_DAYS,
    extra: dict[str, pd.Series] | None = None,
) -> pd.DataFrame:
    """One row per scored day and variant for one symbol, month by month, fits purged of the last H days."""
    rows = []
    scorable = daily.dropna(subset=["target"])
    months = scorable.index.to_period("M")
    for month in months.unique():
        part = scorable[months == month]
        trailing = scorable[scorable.index < part.index[0]].iloc[:-horizon]
        if len(trailing) < min_days:
            continue
        actual = part["big"].to_numpy()
        base = float(trailing["big"].mean())
        probs = horizon_probabilities(trailing, part)
        for name, series in (extra or {}).items():
            if not part.index.isin(series.index).all():
                continue
            raw = series.loc[part.index].to_numpy()
            probs[name] = raw
            # Calibrate on the earlier days the model scored, purged like every other fit.
            seen = trailing.index.intersection(series.index)
            if len(seen) >= min_days:
                calibrated = _fit_or_constant(_logit(series.loc[seen].to_numpy()), trailing.loc[seen, "big"].to_numpy(),
                                              _logit(raw), base)
                probs[name + CALIBRATED] = calibrated
            # The model against its own recent level, and a stacker over the model and the pattern.
            level = relative_level(series)
            if part.index.isin(level.index).all():
                probs[name + OWN_MEDIAN] = level.loc[part.index].to_numpy()
            stacked = stacked_probabilities(trailing, part, series)
            if stacked is not None:
                probs[name + STACKED] = stacked
        for name, prob in probs.items():
            rows += [{"symbol": symbol, "month": str(month), "variant": name, "day": day, "prob": float(p),
                      "actual": bool(a), "base_rate": base, "threshold": float(u)}
                     for day, p, a, u in zip(part.index, prob, actual, part["usual"])]
        _progress(f"[{symbol}] {month}, {horizon}-day window: {len(part)} days; "
                  + ", ".join(f"{n} {np.mean((p > 0.5) == actual):.0%}" for n, p in probs.items()))
    return pd.DataFrame(rows)


def platform_horizon_lstm(
    datasets: dict[str, pd.DataFrame],
    horizon: int,
    train_end: str = config.PLATFORM_LSTM_TRAIN_END,
    val_end: str = config.PLATFORM_LSTM_VAL_END,
    lookback: int = config.PLATFORM_LSTM_LOOKBACK,
    units: int = config.PLATFORM_LSTM_UNITS,
    verbose: int = 2,
    seed: int = config.SEED,
    feature_cols: tuple[str, ...] = tuple(config.VOLATILITY_FEATURES),
    relative_label: bool = False,
) -> dict[str, pd.Series]:
    """One LSTM for every symbol on the H-day label, purged of the last H labels before each boundary.

    By default each symbol's training cut-off is the median H-day volatility
    of its training rows, the convention of pooled.pooled_volatility_predictions,
    which does the training. With relative_label the model is fit on the
    question it is scored on: the next H days against the rolling usual
    level of horizon_daily, so a calm or stormy stretch does not move its
    calls off the 0.5 line. Returns P(more volatile than usual) for each
    symbol's days after val_end, indexed by the day the forecast is made.
    """
    from .pooled import pooled_volatility_predictions

    periods = {}
    for symbol, data in datasets.items():
        labelled = data.assign(target=future_volatility(data["ret"], horizon)).dropna(subset=["target"])
        if relative_label:
            daily = horizon_daily(data, horizon)
            labelled = labelled.loc[labelled.index.intersection(daily.index)].assign(big=daily["big"])
        train, val = labelled.loc[:train_end], labelled.loc[train_end:val_end].iloc[1:]
        part = labelled.loc[val_end:].iloc[1:]
        periods[symbol] = (train, val, part, pd.concat([train, val]))
    probs = pooled_volatility_predictions(periods, tuple(feature_cols), lookback, units, seed=seed,
                                          verbose=verbose, purge=horizon, label="big" if relative_label else None)
    return {symbol: pd.Series(probs[symbol], index=periods[symbol][2].index) for symbol in periods}


def horizon_calibration_rows(
    horizon: int,
    symbols: list[str] | None = None,
    with_platform_lstm: bool = False,
    load: Callable[[], dict[str, pd.DataFrame]] = load_platform_prices,
    verbose: int = 2,
) -> pd.DataFrame:
    """Day rows for every symbol at one horizon, plus the platform-trained LSTM when asked."""
    prices = load()
    symbols = symbols or sorted(prices)
    datasets = {symbol: platform_dataset(prices, symbol) for symbol in symbols}
    extra = {}
    if with_platform_lstm:
        _progress(f"[all symbols] training {PLATFORM_LSTM} for the {horizon}-day window on days to "
                  f"{config.PLATFORM_LSTM_TRAIN_END}, stopping on days to {config.PLATFORM_LSTM_VAL_END}")
        extra = {symbol: {PLATFORM_LSTM: series}
                 for symbol, series in platform_horizon_lstm(datasets, horizon, verbose=verbose).items()}
    tables = [horizon_rows(horizon_daily(datasets[symbol], horizon), symbol, horizon, extra=extra.get(symbol))
              for symbol in symbols]
    return pd.concat(tables, ignore_index=True)


def ensemble_platform_lstm(
    datasets: dict[str, pd.DataFrame], horizon: int, seeds: int = config.EXPERIMENT_SEEDS,
    feature_cols: tuple[str, ...] = tuple(config.VOLATILITY_FEATURES), verbose: int = 0, **kwargs,
) -> dict[str, pd.Series]:
    """The platform LSTM trained `seeds` times with different seeds, probabilities averaged per symbol.

    Averaging over seeds removes the initialisation noise a small model on a
    short platform year carries; each member is trained exactly as the single
    model is.
    """
    members = []
    for i in range(seeds):
        _progress(f"[all symbols] ensemble member {i + 1} of {seeds}, {horizon}-day window, seed {config.SEED + i}")
        members.append(platform_horizon_lstm(datasets, horizon, seed=config.SEED + i, feature_cols=feature_cols,
                                             verbose=verbose, **kwargs))
    return {symbol: pd.concat([m[symbol] for m in members], axis=1).mean(axis=1) for symbol in members[0]}


def relative_level(series: pd.Series, window: int = config.PLATFORM_CALIBRATION_MIN_DAYS) -> pd.Series:
    """Each reading's percentile among the previous `window` readings of the same model: 0.5 is its usual level.

    A model that runs hot still ranks its days; this reads the ranking as a
    call against the model's own recent past instead of the fixed 0.5 line.
    Days without a full window of earlier readings are left out.
    """
    values = series.to_numpy(dtype=float)
    out = np.full(len(values), np.nan)
    for i in range(window, len(values)):
        earlier = values[i - window:i]
        out[i] = float(np.mean(earlier < values[i]) + 0.5 * np.mean(earlier == values[i]))
    return pd.Series(out, index=series.index).dropna()


def stacked_probabilities(trailing: pd.DataFrame, part: pd.DataFrame, series: pd.Series) -> np.ndarray | None:
    """A logistic layer over the model's probability and the persistence inputs, fit on trailing days only.

    Returns None when the model has not scored enough trailing days to fit on.
    """
    seen = trailing.index.intersection(series.index)
    if len(seen) < config.PLATFORM_CALIBRATION_MIN_DAYS or not part.index.isin(series.index).all():
        return None
    def features(frame: pd.DataFrame, prob: np.ndarray) -> np.ndarray:
        p = np.clip(prob, 1e-6, 1 - 1e-6)
        return np.column_stack([np.log(p / (1 - p)), np.log(frame["past"].to_numpy() / frame["usual"].to_numpy()),
                                frame[list(config.PLATFORM_PERSISTENCE_FEATURES)].to_numpy()])
    fit = trailing.loc[seen]
    return _fit_or_constant(features(fit, series.loc[seen].to_numpy()), fit["big"].to_numpy(),
                            features(part, series.loc[part.index].to_numpy()), float(fit["big"].mean()))


def platform_dataset_extended(prices: dict[str, pd.DataFrame], symbol: str) -> pd.DataFrame:
    """The platform dataset with the intraday range and longer volatility inputs (EXTENDED_VOLATILITY_FEATURES)."""
    return add_range_features(platform_dataset(prices, symbol), prices[symbol]).dropna()
