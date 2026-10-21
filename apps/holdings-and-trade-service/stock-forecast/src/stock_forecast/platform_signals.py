"""The platform risk signal the client UI reads: "will the next week be more volatile than usual?"

One LSTM trained on the platform's own market (platform_horizon.platform_horizon_lstm,
PLATFORM_SIGNAL_HORIZON days) scores every symbol's days after its training
span. For each day the file carries the probability, the call it implies,
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

import pandas as pd

from . import config
from .platform_demo import load_platform_prices, platform_dataset
from .platform_horizon import horizon_daily, platform_horizon_lstm

STORMIER, CALMER = "stormier", "calmer"
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


def export_signals(
    horizon: int = config.PLATFORM_SIGNAL_HORIZON,
    load: Callable[[], dict[str, pd.DataFrame]] = load_platform_prices,
    verbose: int = 2,
) -> tuple[dict, Path]:
    """Train the platform model, build the document and write it; returns both."""
    prices = load()
    datasets = {symbol: platform_dataset(prices, symbol) for symbol in sorted(prices)}
    probabilities = platform_horizon_lstm(datasets, horizon, verbose=verbose)
    document = build_signals(datasets, probabilities, horizon)
    return document, write_signals(document)
