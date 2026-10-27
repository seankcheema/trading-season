"""Apply the frozen real-data models to TradingSeason's simulated prices.

A demo that the pipeline runs end to end on the platform's data, never
evidence of skill: the simulation follows scripted monthly trends, so a
trivial trend-following rule scores well there. Nothing is trained here.

Two variants are scored on the same days. "As trained" uses the saved
scalers and the real-data big-move threshold. "Recalibrated" re-fits only the
input scalers and the threshold on the warm-up rows that precede the scored
period (the rows the 60-day windows need anyway), and keeps the trained
model weights. Scored rows never inform either variant.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .data import add_indicators, build_dataset, load_prices, split_by_date
from .evaluate import direction_metrics, event_metrics
from .lstm_model import load_artifacts, predict_up_probability
from .pipeline import big_move_days, big_move_threshold, load_direction_dataset, training_up_rate
from .windows import fit_scalers, make_windows

# Variant names; they label rows in reports/platform_demo.csv.
AS_TRAINED = "as trained"
RECALIBRATED = "recalibrated"


def load_platform_prices(directory: Path = config.PLATFORM_DIR) -> dict[str, pd.DataFrame]:
    """Every exported <symbol>.csv in the folder, keyed by upper-case symbol."""
    files = sorted(Path(directory).glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No platform CSVs in {directory}; run export-platform-daily.py first")
    return {path.stem.upper(): load_prices(path) for path in files}


def platform_market(prices: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """A stand-in for SPY: the equal-weight average daily return of every platform stock, as a price path."""
    returns = pd.concat({symbol: p["Close"].pct_change() for symbol, p in prices.items()}, axis=1).mean(axis=1)
    return pd.DataFrame({"Close": 100 * (1 + returns.fillna(0)).cumprod()})


def platform_dataset(prices: dict[str, pd.DataFrame], symbol: str = config.PLATFORM_SYMBOL) -> pd.DataFrame:
    """The indicator dataset for one platform symbol, with the platform market in place of SPY."""
    return add_indicators(build_dataset(prices[symbol], platform_market(prices)))


def scheduled_spikes(path: Path = config.PLATFORM_SIM_CONFIG) -> list[tuple[str, pd.Timestamp, pd.Timestamp]]:
    """The simulation's scheduled volatility spikes as (id, first day, last day), from its config file."""
    overlays = json.loads(Path(path).read_text(encoding="utf-8")).get("overlays", [])
    return [(o["id"], pd.Timestamp(o["start"]), pd.Timestamp(o["end"]))
            for o in overlays if o.get("condition") == "volatility_spike"]


def daily_big_move_probability(data: pd.DataFrame) -> pd.DataFrame:
    """The saved volatility model's P(big move), as trained, for every scorable day.

    Indexed by the day the forecast is for (the next trading day), with the
    move that day actually made and whether it passed the real-data cut-off.
    Rows before the model's first full window are left out.
    """
    model, scalers = load_artifacts(config.VOLATILITY_MODEL_DIR)
    lookback = int(model.input_shape[1])
    warmup, scored = data.iloc[: lookback - 1], data.iloc[lookback - 1:]
    X, _ = make_windows(scored, scalers, lookback, history=warmup)
    threshold = big_move_threshold(split_by_date(load_direction_dataset()).train)
    # The forecast made at day t's close is about day t + 1, the next row of data.
    forecast_for = data.index[lookback:]
    scored = scored.iloc[: len(forecast_for)]
    return pd.DataFrame({"prob_big": predict_up_probability(model, X)[: len(forecast_for)],
                         "move": scored["target"].abs().to_numpy(),
                         "big": scored["target"].abs().to_numpy() > threshold},
                        index=pd.Index(forecast_for, name="forecast_for"))


def spike_summary(daily: pd.DataFrame, spikes: list[tuple[str, pd.Timestamp, pd.Timestamp]]) -> list[dict]:
    """Average probability and actual big-move rate inside each scored spike versus all other scored days."""
    rows = []
    in_any = pd.Series(False, index=daily.index)
    for spike_id, start, end in spikes:
        inside = (daily.index >= start) & (daily.index <= end)
        in_any |= inside
        if not inside.any():
            continue  # a spike in the warm-up months has no forecasts
        before = daily.index[(daily.index < start)][-5:]
        rows.append({"spike": spike_id, "days": int(inside.sum()),
                     "prob_in_spike": float(daily.loc[inside, "prob_big"].mean()),
                     "prob_week_before": float(daily.loc[before, "prob_big"].mean()),
                     "big_rate_in_spike": float(daily.loc[inside, "big"].mean()),
                     "avg_move_in_spike": float(daily.loc[inside, "move"].mean())})
    other = daily.loc[~in_any.to_numpy()]
    for row in rows:
        row.update({"prob_other_days": float(other["prob_big"].mean()), "big_rate_other_days": float(other["big"].mean()),
                    "avg_move_other_days": float(other["move"].mean())})
    return rows


def _score(task, variant, name, target, prob, base_rate, threshold=None) -> dict:
    if task == "direction":
        m = direction_metrics(target, prob, base_rate)
        accuracy, call_rate, event_rate = m["direction_accuracy"], m["up_call_rate"], m["actual_up_rate"]
    else:
        actual = np.abs(target) > threshold
        m = event_metrics(actual, prob, base_rate)
        accuracy, call_rate, event_rate = m["accuracy"], m["call_rate"], m["event_rate"]
    return {"task": task, "variant": variant, "model": name, "days": int(len(target)), "accuracy": accuracy,
            "auc": m["auc"], "brier_skill": m["brier_skill"], "call_rate": call_rate, "event_rate": event_rate,
            "threshold": threshold}


def platform_rows(data: pd.DataFrame) -> tuple[list[dict], pd.Timestamp, pd.Timestamp]:
    """Score both frozen models, as trained and recalibrated, against simple rules on the same days.

    Returns the rows and the first and last scored dates.
    """
    real_train = split_by_date(load_direction_dataset()).train
    real_threshold, real_up_rate = big_move_threshold(real_train), training_up_rate(real_train)
    rows = []
    for task, directory in (("direction", config.DIRECTION_MODEL_DIR), ("volatility", config.VOLATILITY_MODEL_DIR)):
        model, scalers = load_artifacts(directory)
        lookback = int(model.input_shape[1])
        # The first lookback - 1 rows are the warm-up: history for the first window, and the only
        # rows recalibration may see. Every model and rule is scored on the rows after them.
        warmup, scored = data.iloc[: lookback - 1], data.iloc[lookback - 1:]
        cols = scalers.feature_cols
        recalibrated = fit_scalers(warmup.iloc[:-1], cols)  # last warm-up label belongs to the scored period
        probs = {}
        for variant, sc in ((AS_TRAINED, scalers), (RECALIBRATED, recalibrated)):
            X, _ = make_windows(scored, sc, lookback, history=warmup)
            probs[variant] = predict_up_probability(model, X)
        target = scored["target"].to_numpy()
        if task == "direction":
            trend = (scored[f"momentum_{config.MOMENTUM_WINDOW}"].to_numpy() > 0).astype(float)
            for variant in (AS_TRAINED, RECALIBRATED):
                rows.append(_score(task, variant, "LSTM direction", target, probs[variant], real_up_rate))
            rows.append(_score(task, "rule", "Always up", target, np.full(len(target), real_up_rate), real_up_rate))
            rows.append(_score(task, "rule", "Follow the 20-day trend", target, trend, real_up_rate))
        else:
            for variant, threshold in ((AS_TRAINED, real_threshold), (RECALIBRATED, big_move_threshold(warmup))):
                actual = np.abs(target) > threshold
                base = float((np.abs(warmup["target"].iloc[:-1]) > threshold).mean()) if variant == RECALIBRATED else 0.5
                rows.append(_score(task, variant, "LSTM volatility", target, probs[variant], base, threshold))
                # Rules on the same days and the same cut-off: the better constant answer, and today's move size.
                one = np.full(len(target), float(actual.mean() >= 0.5))
                same = (scored["abs_ret"].to_numpy() > threshold).astype(float)
                rows.append(_score(task, variant, "One answer every day (hindsight)", target, one, base, threshold))
                rows.append(_score(task, variant, "Same as today", target, same, base, threshold))
    return rows, scored.index.min(), scored.index.max()
