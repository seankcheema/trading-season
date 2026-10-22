"""The platform risk signal the client UI reads: "will the next week be more volatile than usual?"

A seed ensemble of LSTMs trained on the platform's own market
(platform_horizon.ensemble_platform_lstm, PLATFORM_SIGNAL_SEEDS members,
PLATFORM_SIGNAL_HORIZON days) scores every symbol's days after its training
span. The ensemble ranks days well but its scores sit above 0.5 more often
than the event happens, so the call line is refit each month on the days
already scored and closed (monthly_call_lines) and the probabilities are
shifted so that line is 0.5 (move_call_line): the ranking is untouched, and
every number in the file is still known on its day. For each day the file
carries the probability, the call it implies,
the "usual" level it is measured against, and a running track record for
the model and for the rule "the next days will be like the last ones",
counted only over windows that had already closed by that day. A card can
therefore say "right N of the last M times" on any simulated date without
reading the future, and decide for itself whether the model has earned a
place over the rule.

The fields are a contract with the client UI (apps/client-ui/public/forecast).
Change both sides together. Simulated prices: a demo, never evidence.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

from . import config
from .platform_calibration import _logit, _progress
from .platform_demo import load_platform_prices, platform_dataset
from .platform_horizon import ensemble_platform_lstm, horizon_daily, platform_horizon_lstm

STORMIER, CALMER = "stormier", "calmer"
CALL_LINE_GRID = np.round(np.linspace(0.3, 0.8, 101), 3)
DAY_FIELDS = ("date", "probability", "call", "usualVolatility", "recentVolatility",
              "modelHits", "modelDays", "ruleHits", "ruleDays", "outcome")


def symbol_days(daily: pd.DataFrame, prob: pd.Series, horizon: int) -> list[dict]:
    """The day records for one symbol, in date order, from its scored days and probabilities.

    A day's outcome is known once its window has closed; the running counts
    at day i include only days whose window closed at or before day i, so
    nothing on a record depends on prices after its date.
    """
    scored = daily.loc[daily.index.intersection(prob.index)].copy()
    scored["prob"] = prob.loc[scored.index]
    scored["model_call"] = scored["prob"] > 0.5
    scored["rule_call"] = scored["past"] > scored["usual"]
    known = scored["target"].notna()
    model_right = ((scored["model_call"] == scored["big"]) & known).to_numpy()
    rule_right = ((scored["rule_call"] == scored["big"]) & known).to_numpy()
    known = known.to_numpy()
    records = []
    for i, (day, row) in enumerate(scored.iterrows()):
        closed = slice(0, max(0, i - horizon + 1))  # windows of days j with j + horizon <= i
        records.append({
            "date": day.strftime("%Y-%m-%d"),
            "probability": round(float(row["prob"]), 4),
            "call": STORMIER if row["model_call"] else CALMER,
            "usualVolatility": round(float(row["usual"]), 6),
            "recentVolatility": round(float(row["past"]), 6),
            "modelHits": int(model_right[closed].sum()),
            "modelDays": int(known[closed].sum()),
            "ruleHits": int(rule_right[closed].sum()),
            "ruleDays": int(known[closed].sum()),
            "outcome": None if pd.isna(row["target"]) else (STORMIER if row["big"] else CALMER),
        })
    return records


def build_signals(
    datasets: dict[str, pd.DataFrame],
    probabilities: dict[str, pd.Series],
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    generated_at: datetime | None = None,
) -> dict:
    """Assemble the signals document from each symbol's dataset and the model's probabilities."""
    generated_at = generated_at or datetime.now(timezone.utc)
    document = {
        "generatedAt": generated_at.replace(microsecond=0).isoformat(),
        "question": f"Will the next {horizon} trading days be more volatile than usual for this stock?",
        "horizonDays": horizon,
        "usualWindowDays": config.PLATFORM_CALIBRATION_MIN_DAYS,
        "model": (f"LSTM trained on the platform's market, every symbol pooled, days to {config.PLATFORM_LSTM_TRAIN_END}, "
                  f"early-stopped on days to {config.PLATFORM_LSTM_VAL_END}; scored on later days only"),
        "rule": f"The next {horizon} days will be like the last {horizon}",
        "symbols": {},
    }
    for symbol in sorted(datasets):
        if symbol not in probabilities:
            raise ValueError(f"No probabilities for {symbol}")
        days = symbol_days(horizon_daily(datasets[symbol], horizon), probabilities[symbol], horizon)
        document["symbols"][symbol] = {"firstDay": days[0]["date"], "lastDay": days[-1]["date"], "days": days}
    validate_signals(document)
    return document


def validate_signals(document: dict) -> None:
    """Raise ValueError if the document breaks the contract with the UI."""
    for key in ("generatedAt", "question", "horizonDays", "usualWindowDays", "model", "rule", "symbols"):
        if key not in document:
            raise ValueError(f"Missing {key}")
    if not document["symbols"]:
        raise ValueError("No symbols")
    for symbol, entry in document["symbols"].items():
        days = entry.get("days") or []
        if not days:
            raise ValueError(f"{symbol} has no days")
        dates = [d["date"] for d in days]
        if dates != sorted(dates) or len(set(dates)) != len(dates):
            raise ValueError(f"{symbol} days must be in date order without repeats")
        if entry.get("firstDay") != dates[0] or entry.get("lastDay") != dates[-1]:
            raise ValueError(f"{symbol} firstDay/lastDay do not match its days")
        for d in days:
            if tuple(d) != DAY_FIELDS:
                raise ValueError(f"{symbol} {d.get('date')}: fields must be exactly {DAY_FIELDS}")
            if not 0.0 <= d["probability"] <= 1.0:
                raise ValueError(f"{symbol} {d['date']}: probability out of range")
            if d["call"] not in (STORMIER, CALMER) or d["outcome"] not in (STORMIER, CALMER, None):
                raise ValueError(f"{symbol} {d['date']}: call and outcome must be stormier or calmer")
            if not (0 <= d["modelHits"] <= d["modelDays"] and 0 <= d["ruleHits"] <= d["ruleDays"]):
                raise ValueError(f"{symbol} {d['date']}: hits exceed days")


def write_signals(document: dict, path: Path = config.PLATFORM_SIGNALS_JSON) -> Path:
    """Validate and write the document as compact JSON."""
    validate_signals(document)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def summarise_signals(document: dict) -> pd.DataFrame:
    """One row per symbol: the final track record of the model and the rule over the scored days."""
    rows = []
    for symbol, entry in document["symbols"].items():
        last = entry["days"][-1]
        rows.append({"symbol": symbol, "days_scored": last["modelDays"],
                     "model_accuracy": last["modelHits"] / last["modelDays"] if last["modelDays"] else float("nan"),
                     "rule_accuracy": last["ruleHits"] / last["ruleDays"] if last["ruleDays"] else float("nan")})
    table = pd.DataFrame(rows)
    table["model_ahead"] = table["model_accuracy"] > table["rule_accuracy"]
    return table


def best_call_line(prob: np.ndarray, actual: np.ndarray, grid: np.ndarray = CALL_LINE_GRID) -> float:
    """The line above which a score should call stormier: the most accurate on these days, middle of a tie."""
    scores = np.array([np.mean((prob > line) == actual) for line in grid])
    best = np.flatnonzero(scores == scores.max())
    return float(grid[best[len(best) // 2]])


def monthly_call_lines(
    dailies: dict[str, pd.DataFrame], probabilities: dict[str, pd.Series], horizon: int,
    min_days: int = config.PLATFORM_CALIBRATION_MIN_DAYS,
) -> dict[str, float]:
    """The call line for every scored month, fit on the days before it whose windows had closed.

    Pooled over symbols; the last `horizon` days before the month are left
    out because their windows reach into it. Until every symbol has
    `min_days` such days the line stays at 0.5.
    """
    scored = {}
    for symbol, prob in probabilities.items():
        daily = dailies[symbol]
        days = daily.index.intersection(prob.index)
        scored[symbol] = pd.DataFrame({"prob": prob.loc[days], "big": daily.loc[days, "big"],
                                       "known": daily.loc[days, "target"].notna()})
    months = sorted({str(m) for frame in scored.values() for m in frame.index.to_period("M").unique()})
    lines = {}
    for month in months:
        start = pd.Period(month).to_timestamp()
        earlier = [frame[(frame.index < start) & frame["known"]].iloc[:-horizon] for frame in scored.values()]
        if min(len(frame) for frame in earlier) < min_days:
            lines[month] = 0.5
            continue
        pooled = pd.concat(earlier)
        lines[month] = best_call_line(pooled["prob"].to_numpy(), pooled["big"].to_numpy())
    return lines


def move_call_line(prob: pd.Series, lines: dict[str, float]) -> pd.Series:
    """Shift each day's score so its month's call line sits at 0.5; the order of the days is unchanged."""
    line = prob.index.to_period("M").astype(str).map(lambda m: lines.get(m, 0.5)).to_numpy(dtype=float)
    clipped = prob.clip(1e-6, 1 - 1e-6).to_numpy()
    shifted = 1.0 / (1.0 + np.exp(-(_logit(clipped).ravel() - _logit(line).ravel())))
    return pd.Series(shifted, index=prob.index)


Trainer = Callable[..., dict[str, pd.Series]]


def monthly_platform_probabilities(
    datasets: dict[str, pd.DataFrame],
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    first_month: str = config.PLATFORM_SIGNAL_FIRST_MONTH,
    trainer: Trainer = platform_horizon_lstm,
    verbose: int = 2,
) -> dict[str, pd.Series]:
    """Retrain every month: fit on the days before the previous month, stop on it, score the month itself.

    Each month's model has seen one more month of this market than the last,
    the way a production model would be refreshed. The first scored month is
    first_month; the last is the last month the datasets cover.
    """
    index = next(iter(datasets.values())).index
    months = [m for m in index.to_period("M").unique() if str(m) >= first_month]
    parts: dict[str, list[pd.Series]] = {symbol: [] for symbol in datasets}
    for month in months:
        start = month.to_timestamp()
        val_end = (start - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        train_end = ((month - 1).to_timestamp() - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        _progress(f"[all symbols] {month}: training on days to {train_end}, stopping on days to {val_end}")
        scored = trainer(datasets, horizon, train_end=train_end, val_end=val_end, verbose=verbose)
        end = (month + 1).to_timestamp() - pd.Timedelta(days=1)
        for symbol, series in scored.items():
            parts[symbol].append(series.loc[start:end])
    return {symbol: pd.concat(series_list) for symbol, series_list in parts.items()}


def export_signals(
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    load: Callable[[], dict[str, pd.DataFrame]] = load_platform_prices,
    verbose: int = 2,
    retrain: str = "once",
    seeds: int = config.PLATFORM_SIGNAL_SEEDS,
    refit_call_line: bool = True,
) -> tuple[dict, Path]:
    """Train the platform model, build the document and write it; returns both.

    retrain "once" trains on the days to PLATFORM_LSTM_TRAIN_END, as one model
    (seeds=1) or a seed ensemble; "monthly" refreshes one model every month
    (monthly_platform_probabilities). With refit_call_line each month's call
    line is fit on the closed days before it and the scores are shifted so
    it reads 0.5; without it the raw scores are written.
    """
    if retrain not in ("once", "monthly"):
        raise ValueError(f"retrain must be once or monthly, got {retrain}")
    if seeds < 1:
        raise ValueError(f"seeds must be at least 1, got {seeds}")
    prices = load()
    datasets = {symbol: platform_dataset(prices, symbol) for symbol in sorted(prices)}
    if retrain == "monthly":
        probabilities = monthly_platform_probabilities(datasets, horizon, verbose=verbose)
        trained = (f"LSTM trained on the platform's market, every symbol pooled, refreshed every month from "
                   f"{config.PLATFORM_SIGNAL_FIRST_MONTH}: each month is scored by a model fit on the days before "
                   f"the previous month and early-stopped on it")
    elif seeds == 1:
        probabilities = platform_horizon_lstm(datasets, horizon, verbose=verbose)
        trained = (f"LSTM trained on the platform's market, every symbol pooled, days to "
                   f"{config.PLATFORM_LSTM_TRAIN_END}, early-stopped on days to {config.PLATFORM_LSTM_VAL_END}; "
                   f"scored on later days only")
    else:
        probabilities = ensemble_platform_lstm(datasets, horizon, seeds=seeds, verbose=verbose)
        trained = (f"{seeds} LSTMs trained on the platform's market with different seeds, every symbol pooled, "
                   f"days to {config.PLATFORM_LSTM_TRAIN_END}, early-stopped on days to "
                   f"{config.PLATFORM_LSTM_VAL_END}, scores averaged; scored on later days only")
    lines = {}
    if refit_call_line:
        dailies = {symbol: horizon_daily(datasets[symbol], horizon) for symbol in datasets}
        lines = monthly_call_lines(dailies, probabilities, horizon)
        probabilities = {symbol: move_call_line(prob, lines) for symbol, prob in probabilities.items()}
        trained += ("; each month's call line is refit on the closed days before it, pooled over symbols, "
                    "and the scores are shifted so it reads 0.5")
    document = build_signals(datasets, probabilities, horizon)
    document["model"] = trained
    document["callLines"] = lines
    return document, write_signals(document)
