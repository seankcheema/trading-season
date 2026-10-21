"""Making the frozen volatility model useful on the platform's prices, without retraining it.

The platform demo showed the saved model's probabilities rank the platform's
days (AUC above 0.55 on most symbols) but are miscalibrated: the real-AAPL
cut-off does not fit synthetic prices, so it almost never calls a big move.
Four variants are scored month by month through the platform year, on every
symbol, against the two rules a client could follow without a model:

- LSTM as trained: the saved model's probability, called at 0.5.
- LSTM calibrated: the same score through a logistic mapping (Platt scaling)
  fit on the symbol's earlier platform days. Monotone, so the ranking is kept.
- Recent volatility, platform fit: a logistic regression on today's move size
  and 10-day volatility, fit on the symbol's earlier platform days.
- Blend: the mean of the two probabilities above.

A big move is "bigger than usual for this stock": larger than the median
move over the PLATFORM_CALIBRATION_MIN_DAYS platform days before it, so the
cut-off follows the simulation's volatility regimes instead of lagging them.
Every fitted mapping sees only days before the month being scored.

--with-platform-lstm adds one LSTM trained on the platform's own market
(every symbol pooled, the months before PLATFORM_LSTM_TRAIN_END), scored on
the months after. It is a different claim from the frozen research model
and is labelled as such.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from . import config
from .baselines import fit_logistic
from .evaluate import event_metrics
from .platform_demo import daily_big_move_probability, load_platform_prices, platform_dataset

LSTM_RAW = "LSTM as trained"
LSTM_CALIBRATED = "LSTM calibrated"
PERSISTENCE = "Recent volatility, platform fit"
BLEND = "Blend: calibrated LSTM + recent volatility"
ONE_ANSWER = "One answer every day"
SAME_AS_TODAY = "Same as today"
PLATFORM_LSTM = "LSTM trained on the platform"
NO_RETRAIN_VARIANTS = (LSTM_RAW, LSTM_CALIBRATED, PERSISTENCE, BLEND, ONE_ANSWER, SAME_AS_TODAY)


def _progress(message: str) -> None:
    print(message, flush=True)  # flush so a log followed with tail -f updates at once


def platform_scores(data: pd.DataFrame) -> pd.DataFrame:
    """The frozen model's score for each forecast day, with the features known when it was made.

    Indexed by the day the forecast is for. move is that day's move size;
    the feature columns come from the row before it, the close the forecast
    was made at.
    """
    daily = daily_big_move_probability(data)[["prob_big", "move"]].copy()
    n = len(daily)
    made_at = data.iloc[len(data) - n - 1 : len(data) - 1]
    assert (made_at.index < daily.index).all()
    for col in config.PLATFORM_PERSISTENCE_FEATURES:
        daily[col] = made_at[col].to_numpy()
    return daily


def _logit(prob: np.ndarray) -> np.ndarray:
    p = np.clip(np.asarray(prob, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p)).reshape(-1, 1)


def _fit_or_constant(X_fit: np.ndarray, y_fit: np.ndarray, X_part: np.ndarray, constant: float) -> np.ndarray:
    """A logistic regression's probabilities, or the constant when the fitting labels are all one class."""
    if y_fit.all() or not y_fit.any():
        return np.full(len(X_part), constant)
    return fit_logistic(X_fit, y_fit).predict_proba(X_part)[:, 1]


def usual_move(daily: pd.DataFrame, window: int = config.PLATFORM_CALIBRATION_MIN_DAYS) -> pd.Series:
    """Each day's cut-off for "bigger than usual": the median move of the window days before it."""
    return daily["move"].shift(1).rolling(window).median()


def variant_probabilities(trailing: pd.DataFrame, part: pd.DataFrame) -> dict[str, np.ndarray]:
    """Each variant's P(big move) for the days of part, fit on trailing only.

    Both frames carry a big column (the day's move beat its usual) and a
    usual column (that day's cut-off).
    """
    y_fit = trailing["big"].to_numpy()
    base = float(y_fit.mean())
    feats = list(config.PLATFORM_PERSISTENCE_FEATURES)
    calibrated = _fit_or_constant(_logit(trailing["prob_big"]), y_fit, _logit(part["prob_big"]), base)
    persistence = _fit_or_constant(trailing[feats].to_numpy(), y_fit, part[feats].to_numpy(), base)
    return {
        LSTM_RAW: part["prob_big"].to_numpy(),
        LSTM_CALIBRATED: calibrated,
        PERSISTENCE: persistence,
        BLEND: (calibrated + persistence) / 2,
        # The constant a client could pick in advance: the more common answer so far.
        ONE_ANSWER: np.full(len(part), float(base >= 0.5)),
        SAME_AS_TODAY: (part["abs_ret"].to_numpy() > part["usual"].to_numpy()).astype(float),
    }


def monthly_rows(
    daily: pd.DataFrame,
    symbol: str,
    min_days: int = config.PLATFORM_CALIBRATION_MIN_DAYS,
    extra: dict[str, pd.Series] | None = None,
) -> pd.DataFrame:
    """One row per scored day and variant for one symbol.

    Each month is scored with the fitted mappings taken from the days before
    it. Every day's cut-off is the median move of the min_days days before
    it, so the first months, where that is undefined, are skipped. extra maps
    a variant name to a probability Series indexed by forecast day, scored on
    the months it covers in full.
    """
    rows = []
    daily = daily.assign(usual=usual_move(daily, min_days))
    daily = daily.assign(big=daily["move"] > daily["usual"]).dropna(subset=["usual"])
    months = daily.index.to_period("M")
    for month in months.unique():
        part = daily[months == month]
        trailing = daily[daily.index < part.index[0]]
        if len(trailing) < min_days:
            continue
        actual = part["big"].to_numpy()
        base = float(trailing["big"].mean())
        threshold = float(part["usual"].iloc[0])
        probs = variant_probabilities(trailing, part)
        for name, series in (extra or {}).items():
            if part.index.isin(series.index).all():
                probs[name] = series.loc[part.index].to_numpy()
        for name, prob in probs.items():
            rows += [{"symbol": symbol, "month": str(month), "variant": name, "day": day, "prob": float(p),
                      "actual": bool(a), "base_rate": base, "threshold": threshold}
                     for day, p, a in zip(part.index, prob, actual)]
        _progress(f"[{symbol}] {month}: {len(part)} days, usual move {threshold:.2%} at the start; "
                  + ", ".join(f"{n} {np.mean((p > 0.5) == actual):.0%}" for n, p in probs.items()
                              if n in (BLEND, LSTM_CALIBRATED, ONE_ANSWER, SAME_AS_TODAY, PLATFORM_LSTM)))
    return pd.DataFrame(rows)


def summarise(rows: pd.DataFrame, months: list[str] | None = None) -> pd.DataFrame:
    """Pooled metrics per symbol and variant over the scored days, with the bar each symbol must clear.

    usable is the gate a card should pass: more accurate than both rules a
    client could follow without a model, one answer every day and "same as
    today", on the same days, with Brier skill above zero. months limits
    the table to those months, so variants scored on different spans compare
    on the same days.
    """
    if months is not None:
        rows = rows[rows["month"].isin(months)]
    out = []
    for (symbol, variant), g in rows.groupby(["symbol", "variant"], sort=False):
        m = event_metrics(g["actual"].to_numpy(), g["prob"].to_numpy(), float(g["base_rate"].mean()))
        out.append({"symbol": symbol, "variant": variant, "days": len(g), "months": g["month"].nunique(),
                    **{k: m[k] for k in ("accuracy", "auc", "brier_skill", "call_rate", "event_rate")}})
    table = pd.DataFrame(out)
    rules = table[table["variant"].isin((ONE_ANSWER, SAME_AS_TODAY))].groupby("symbol")["accuracy"].max()
    table["rule_accuracy"] = table["symbol"].map(rules)
    table["usable"] = (table["accuracy"] > table["rule_accuracy"]) & (table["brier_skill"] > 0)
    return table


def platform_lstm_probabilities(
    datasets: dict[str, pd.DataFrame],
    train_end: str = config.PLATFORM_LSTM_TRAIN_END,
    val_end: str = config.PLATFORM_LSTM_VAL_END,
    lookback: int = config.PLATFORM_LSTM_LOOKBACK,
    units: int = config.PLATFORM_LSTM_UNITS,
    verbose: int = 2,
) -> dict[str, pd.Series]:
    """One LSTM trained on every symbol's platform days up to train_end, early-stopped on the days to val_end.

    Returns P(big move) for each symbol's days after val_end, indexed by the
    day each forecast is for. Each symbol keeps its own training cut-off and
    scalers, as in pooled.pooled_volatility_predictions, which does the work.
    """
    from .pooled import pooled_volatility_predictions

    periods = {}
    for symbol, data in datasets.items():
        train, val, part = data.loc[:train_end], data.loc[train_end:val_end].iloc[1:], data.loc[val_end:].iloc[1:]
        periods[symbol] = (train, val, part, pd.concat([train, val]))
    probs = pooled_volatility_predictions(periods, tuple(config.VOLATILITY_FEATURES), lookback, units, verbose=verbose)
    out = {}
    for symbol, (train, val, part, _) in periods.items():
        # part's rows are the closes the forecasts were made at; index each by the day it is for.
        forecast_for = part.index[1:]
        out[symbol] = pd.Series(probs[symbol][: len(forecast_for)], index=forecast_for)
    return out


def calibration_rows(
    symbols: list[str] | None = None,
    with_platform_lstm: bool = False,
    load: Callable[[], dict[str, pd.DataFrame]] = load_platform_prices,
    verbose: int = 2,
) -> pd.DataFrame:
    """Day rows for every symbol: the no-retrain variants, plus the platform-trained LSTM when asked."""
    prices = load()
    symbols = symbols or sorted(prices)
    datasets = {symbol: platform_dataset(prices, symbol) for symbol in symbols}
    extra = {}
    if with_platform_lstm:
        _progress(f"[all symbols] training {PLATFORM_LSTM} on days to {config.PLATFORM_LSTM_TRAIN_END}, "
                  f"stopping on days to {config.PLATFORM_LSTM_VAL_END}")
        extra = {symbol: {PLATFORM_LSTM: series}
                 for symbol, series in platform_lstm_probabilities(datasets, verbose=verbose).items()}
    tables = []
    for symbol in symbols:
        _progress(f"[{symbol}] scoring the frozen model on the platform's days")
        tables.append(monthly_rows(platform_scores(datasets[symbol]), symbol, extra=extra.get(symbol)))
    return pd.concat(tables, ignore_index=True)
