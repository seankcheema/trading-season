"""Buy signal: flag a day only when the direction model's P(up) clears a cutoff.

A flagged day is worth showing a client only if flagged days go up more often
than days in general, so the bar is the up-rate of the same year, not 50%.
The cutoff is chosen on one year and scored on the next, never on the year it
is chosen from.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import binomtest

from . import config
from .pipeline import direction_baselines, direction_lstm_predictions
from .walk_forward import Fold

INDICATOR_MODEL = "Logistic regression (indicators)"
LSTM_MODEL = "LSTM direction"


def signal_metrics(actual_returns: np.ndarray, prob_up: np.ndarray, cutoff: float | None) -> dict:
    """How the days flagged by prob_up >= cutoff turned out; cutoff None flags nothing.

    edge is the flagged days' up-rate minus every day's up-rate: above 0 means
    the signal picked better days than buying every day would have.
    """
    actual = np.asarray(actual_returns, dtype=float)
    prob = np.asarray(prob_up, dtype=float)
    if actual.shape != prob.shape:
        raise ValueError(f"Shape mismatch: {actual.shape} vs {prob.shape}")
    flagged = np.zeros(len(prob), dtype=bool) if cutoff is None else prob >= cutoff
    up = actual > 0
    signals = int(flagged.sum())
    hit_rate = float(up[flagged].mean()) if signals else float("nan")
    return {
        "days": int(len(actual)),
        "signals": signals,
        "hits": int(up[flagged].sum()),
        "signal_rate": signals / len(actual) if len(actual) else float("nan"),
        "hit_rate": hit_rate,
        "up_rate": float(up.mean()),
        "edge": hit_rate - float(up.mean()) if signals else float("nan"),
        "signal_mean_return": float(actual[flagged].mean()) if signals else float("nan"),
        "mean_return": float(actual.mean()),
    }


def choose_cutoff(
    actual_returns: np.ndarray,
    prob_up: np.ndarray,
    cutoffs: list[float] = config.BUY_SIGNAL_CUTOFFS,
    min_signals: int = config.BUY_SIGNAL_MIN_DAYS,
) -> float | None:
    """The candidate cutoff with the largest positive edge and at least min_signals flagged days.

    None when no candidate beats buying every day: then there is no signal to show.
    """
    best, best_edge = None, 0.0
    for cutoff in cutoffs:
        m = signal_metrics(actual_returns, prob_up, cutoff)
        if m["signals"] >= min_signals and m["edge"] > best_edge:
            best, best_edge = cutoff, m["edge"]
    return best


def signal_row(
    name: str, choose_on: pd.DataFrame, choose_prob: np.ndarray, score_on: pd.DataFrame, score_prob: np.ndarray,
) -> dict:
    """Choose a cutoff on choose_on's days, then score it on score_on's days.

    choose_on's last label is score_on's first day, so it is left out of the choice.
    """
    cutoff = choose_cutoff(choose_on["target"].to_numpy()[:-1], choose_prob[:-1])
    chosen = signal_metrics(choose_on["target"].to_numpy()[:-1], choose_prob[:-1], cutoff)
    return {"model": name, "cutoff": cutoff, "chosen_edge": chosen["edge"],
            **signal_metrics(score_on["target"].to_numpy(), score_prob, cutoff)}


def buy_signal_fold(fold: Fold, with_lstm: bool = True) -> list[dict]:
    """Walk-forward step: choose the cutoff on year Y - 1, score it on year Y.

    Each model is fit once per fold on the years before Y - 1 and predicts
    both years, so the cutoff is applied to probabilities from the model it
    was chosen for. The LSTM early-stops on Y - 1, the same year the cutoff
    is chosen on; year Y is never seen before it is scored.
    """
    part = pd.concat([fold.val, fold.test])
    n_val = len(fold.val)
    probs = {INDICATOR_MODEL: direction_baselines(fold.train, part, history=fold.train)[INDICATOR_MODEL]}
    if with_lstm:
        probs[LSTM_MODEL] = direction_lstm_predictions(fold.train, fold.val, part, history=fold.train).prob_up
    return [signal_row(name, fold.val, prob[:n_val], fold.test, prob[n_val:]) for name, prob in probs.items()]


def validation_cutoffs(train: pd.DataFrame, val: pd.DataFrame, with_lstm: bool = True) -> list[dict]:
    """The cutoff each model would freeze for a test run: fit on train, chosen on val.

    The metrics are the val days the cutoff was chosen on, so they flatter the
    rule; the walk-forward rows are the honest check.
    """
    probs = {INDICATOR_MODEL: direction_baselines(train, val, history=train)[INDICATOR_MODEL]}
    if with_lstm:
        probs[LSTM_MODEL] = direction_lstm_predictions(train, val, val, history=train).prob_up
    actual = val["target"].to_numpy()[:-1]
    rows = []
    for name, prob in probs.items():
        cutoff = choose_cutoff(actual, prob[:-1])
        m = signal_metrics(actual, prob[:-1], cutoff)
        rows.append({"model": name, "cutoff": cutoff, "chosen_edge": m["edge"], **m})
    return rows


def luck_p_value(hits: int, signals: int, expected_rate: float) -> float:
    """Chance of at least this many up days among the flagged days if flagging were luck.

    One-sided binomial test against expected_rate, the up-rate the same days
    would have had without the model. Below 0.05 would be hard to call luck.
    """
    if signals == 0:
        return float("nan")
    return float(binomtest(int(hits), int(signals), float(expected_rate), alternative="greater").pvalue)


def summarise_signals(walk: pd.DataFrame) -> pd.DataFrame:
    """One row per model over the walk-forward years: did flagged days beat ordinary days, and by luck?

    expected_hits is what each year's up-rate predicts for that year's flagged
    days, summed; p_value tests the pooled hits against that expectation.
    """
    walk = walk.assign(expected_hits=walk["signals"] * walk["up_rate"], beat_up_rate=walk["edge"] > 0)
    summary = walk.groupby("model").agg(
        years=("year", "nunique"),
        years_with_signal=("signals", lambda s: int((s > 0).sum())),
        years_beating_up_rate=("beat_up_rate", "sum"),
        flagged_days=("signals", "sum"),
        hits=("hits", "sum"),
        expected_hits=("expected_hits", "sum"),
        mean_edge=("edge", "mean"),
    )
    summary["p_value"] = [
        luck_p_value(row.hits, row.flagged_days, row.expected_hits / row.flagged_days) if row.flagged_days else float("nan")
        for row in summary.itertuples()
    ]
    return summary.reset_index()
