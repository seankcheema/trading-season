"""The platform trend signal the client UI reads: "is the price likely to be higher in H trading days?"

The only thing that moves prices in the simulated market over a week is the
regime it is in: a trend regime carries a drift larger than a day's noise,
a sideways one none. So the honest readers of direction are momentum
readers. Two are scored on every symbol's days from PLATFORM_SIGNAL_FIRST_MONTH:

- the pattern: the next H days continue the direction of the last
  PLATFORM_TREND_MOMENTUM_DAYS days;
- the model: a gradient-boosted classifier on momentum inputs
  (PLATFORM_TREND_FEATURES), refit every month on the closed days before it,
  pooled over symbols and purged of the last H days (monthly_trend_probabilities).

For each day the file carries the model's probability, the call it implies,
the momentum the pattern reads, the outcome and the realized move once the
window has closed, and running hit counts for both readers counted only over
windows closed by that day, so a card can quote a record on any simulated
date without reading the future and let the better reader lead.

The fields are a contract with the client UI (apps/client-ui/public/forecast).
Change both sides together. Simulated prices: a demo, never evidence, and
never advice.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

from . import config
from .platform_calibration import _progress
from .platform_demo import load_platform_prices, platform_dataset

UP, DOWN = "up", "down"
TREND_FIELDS = ("date", "probability", "call", "momentum", "modelHits", "modelDays", "ruleHits", "ruleDays",
                "outcome", "move")
MIN_TRAINING_ROWS = 100

NOTICE = ("A machine-learning read on a simulated market. It can be wrong and must not be taken as true, "
          "as a prediction of any real market, or as advice to buy or sell.")


def trend_daily(
    data: pd.DataFrame, close: pd.Series, horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    momentum_days: int = config.PLATFORM_TREND_MOMENTUM_DAYS,
) -> pd.DataFrame:
    """One row per forecast day: the next H days' log return (the label), and the momentum inputs known at the close."""
    if horizon < 1 or momentum_days < 1:
        raise ValueError("horizon and momentum_days must be at least 1")
    log_close = np.log(close.reindex(data.index).astype(float))
    daily = pd.DataFrame({
        "target": log_close.shift(-horizon) - log_close,
        "momentum": log_close - log_close.shift(momentum_days),
        "momentum_5": log_close - log_close.shift(5),
        "momentum_20": log_close - log_close.shift(20),
        "up_share": (data["ret"] > 0).astype(float).rolling(momentum_days).mean(),
    }, index=data.index)
    daily = daily.dropna(subset=["momentum", "momentum_5", "momentum_20", "up_share"])
    daily["up"] = daily["target"] > 0
    return daily


def _default_model():
    from sklearn.ensemble import HistGradientBoostingClassifier
    return HistGradientBoostingClassifier(max_iter=150, learning_rate=0.05, max_depth=3, min_samples_leaf=30,
                                          random_state=config.SEED)


def monthly_trend_probabilities(
    dailies: dict[str, pd.DataFrame],
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    first_month: str = config.PLATFORM_SIGNAL_FIRST_MONTH,
    feature_cols: tuple[str, ...] = tuple(config.PLATFORM_TREND_FEATURES),
    make_model: Callable[[], object] = _default_model,
) -> dict[str, pd.Series]:
    """P(higher in H days) for every symbol's days from first_month, each month scored by a model fit before it.

    The fit for a month uses every earlier day of every symbol whose window
    had closed, minus the last `horizon` days before the month, whose labels
    reach into it. A month with fewer than MIN_TRAINING_ROWS such days, or
    with one-class labels, is not scored.
    """
    months = sorted({str(m) for d in dailies.values() for m in d.index.to_period("M").unique() if str(m) >= first_month})
    parts: dict[str, list[pd.Series]] = {symbol: [] for symbol in dailies}
    cols = list(feature_cols)
    for month in months:
        start = pd.Period(month).to_timestamp()
        train = pd.concat([d[(d.index < start) & d["target"].notna()].iloc[:-horizon] for d in dailies.values()])
        if len(train) < MIN_TRAINING_ROWS or train["up"].nunique() < 2:
            _progress(f"[all symbols] {month}: not scored, {len(train)} closed days before it")
            continue
        model = make_model().fit(train[cols].to_numpy(), train["up"].to_numpy().astype(int))
        _progress(f"[all symbols] {month}: trend model fit on {len(train)} closed days to {train.index.max().date()}")
        for symbol, d in dailies.items():
            part = d[d.index.to_period("M").astype(str) == month]
            if not part.empty:
                parts[symbol].append(pd.Series(model.predict_proba(part[cols].to_numpy())[:, 1], index=part.index))
    return {symbol: pd.concat(series) if series else pd.Series(dtype=float) for symbol, series in parts.items()}


def trend_days(daily: pd.DataFrame, prob: pd.Series, horizon: int) -> list[dict]:
    """The day records for one symbol, in date order; running counts cover only windows closed by each day."""
    scored = daily.loc[daily.index.intersection(prob.index)].copy()
    scored["prob"] = prob.loc[scored.index]
    scored["model_call"] = scored["prob"] > 0.5
    scored["rule_call"] = scored["momentum"] > 0
    known = scored["target"].notna()
    model_right = ((scored["model_call"] == scored["up"]) & known).to_numpy()
    rule_right = ((scored["rule_call"] == scored["up"]) & known).to_numpy()
    known = known.to_numpy()
    records = []
    for i, (day, row) in enumerate(scored.iterrows()):
        closed = slice(0, max(0, i - horizon + 1))
        unknown = pd.isna(row["target"])
        records.append({
            "date": day.strftime("%Y-%m-%d"),
            "probability": round(float(row["prob"]), 4),
            "call": UP if row["model_call"] else DOWN,
            "momentum": round(float(row["momentum"]), 5),
            "modelHits": int(model_right[closed].sum()),
            "modelDays": int(known[closed].sum()),
            "ruleHits": int(rule_right[closed].sum()),
            "ruleDays": int(known[closed].sum()),
            "outcome": None if unknown else (UP if row["up"] else DOWN),
            "move": None if unknown else round(float(row["target"]), 5),
        })
    return records


def build_trend(
    dailies: dict[str, pd.DataFrame],
    probabilities: dict[str, pd.Series],
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    generated_at: datetime | None = None,
) -> dict:
    """Assemble the trend document from each symbol's days and the model's probabilities."""
    generated_at = generated_at or datetime.now(timezone.utc)
    document = {
        "generatedAt": generated_at.replace(microsecond=0).isoformat(),
        "question": f"Is the price likely to be higher in {horizon} trading days?",
        "horizonDays": horizon,
        "momentumDays": config.PLATFORM_TREND_MOMENTUM_DAYS,
        "model": (f"Gradient-boosted classifier on momentum inputs, every symbol pooled, refit every month from "
                  f"{config.PLATFORM_SIGNAL_FIRST_MONTH} on the closed days before it"),
        "rule": f"The next {horizon} days continue the last {config.PLATFORM_TREND_MOMENTUM_DAYS} days' direction",
        "notice": NOTICE,
        "symbols": {},
    }
    for symbol in sorted(dailies):
        if symbol not in probabilities or probabilities[symbol].empty:
            raise ValueError(f"No probabilities for {symbol}")
        days = trend_days(dailies[symbol], probabilities[symbol], horizon)
        document["symbols"][symbol] = {"firstDay": days[0]["date"], "lastDay": days[-1]["date"], "days": days}
    validate_trend(document)
    return document


def validate_trend(document: dict) -> None:
    """Raise ValueError if the document breaks the contract with the UI."""
    for key in ("generatedAt", "question", "horizonDays", "momentumDays", "model", "rule", "notice", "symbols"):
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
            if tuple(d) != TREND_FIELDS:
                raise ValueError(f"{symbol} {d.get('date')}: fields must be exactly {TREND_FIELDS}")
            if not 0.0 <= d["probability"] <= 1.0:
                raise ValueError(f"{symbol} {d['date']}: probability out of range")
            if d["call"] not in (UP, DOWN) or d["outcome"] not in (UP, DOWN, None):
                raise ValueError(f"{symbol} {d['date']}: call and outcome must be up or down")
            if (d["outcome"] is None) != (d["move"] is None):
                raise ValueError(f"{symbol} {d['date']}: outcome and move are known together")
            if not (0 <= d["modelHits"] <= d["modelDays"] and 0 <= d["ruleHits"] <= d["ruleDays"]):
                raise ValueError(f"{symbol} {d['date']}: hits exceed days")


def write_trend(document: dict, path: Path | None = None) -> Path:
    """Validate and write the document as compact JSON."""
    validate_trend(document)
    path = Path(path or config.PLATFORM_TREND_JSON)  # resolved at call time, so tests can point config elsewhere
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def summarise_trend(document: dict) -> pd.DataFrame:
    """One row per symbol: the final record of the model and the pattern, and the mean move after each model call."""
    rows = []
    for symbol, entry in document["symbols"].items():
        days = entry["days"]
        last = days[-1]
        closed = [d for d in days if d["move"] is not None]
        after_up = [d["move"] for d in closed if d["call"] == UP]
        after_down = [d["move"] for d in closed if d["call"] == DOWN]
        rows.append({"symbol": symbol, "days_scored": last["modelDays"],
                     "model_accuracy": last["modelHits"] / last["modelDays"] if last["modelDays"] else float("nan"),
                     "rule_accuracy": last["ruleHits"] / last["ruleDays"] if last["ruleDays"] else float("nan"),
                     "mean_move_after_up_call": float(np.mean(after_up)) if after_up else float("nan"),
                     "mean_move_after_down_call": float(np.mean(after_down)) if after_down else float("nan")})
    table = pd.DataFrame(rows)
    table["model_ahead"] = table["model_accuracy"] > table["rule_accuracy"]
    return table


def export_trend(
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    load: Callable[[], dict[str, pd.DataFrame]] = load_platform_prices,
    first_month: str = config.PLATFORM_SIGNAL_FIRST_MONTH,
) -> tuple[dict, Path]:
    """Score the platform, build the document and write it; returns both."""
    prices = load()
    dailies = {symbol: trend_daily(platform_dataset(prices, symbol), prices[symbol]["Close"], horizon)
               for symbol in sorted(prices)}
    probabilities = monthly_trend_probabilities(dailies, horizon, first_month)
    document = build_trend(dailies, probabilities, horizon)
    return document, write_trend(document)
