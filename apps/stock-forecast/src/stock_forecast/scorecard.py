"""The scorecard file the client UI reads: the model's frozen test results.

Its fields are a contract with the Trend card (apps/client-ui, see
forecast-scorecard.service.ts). Change both together, or neither.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import config

FIELDS = (
    "symbol",
    "model",
    "testPeriod",
    "directionAccuracy",
    "alwaysUpAccuracy",
    "modelReturnRmse",
    "naiveReturnRmse",
    "status",
)
STATUSES = ("placeholder", "final")


def build_scorecard(
    symbol: str,
    model: str,
    test_start: str,
    test_end: str,
    direction_accuracy: float,
    always_up_accuracy: float,
    model_return_rmse: float,
    naive_return_rmse: float,
    status: str = "final",
) -> dict:
    """Assemble a scorecard with the agreed field names, rounded for display."""
    # These camelCase keys are the static-file contract used by the Angular card.
    card = {
        "symbol": symbol,
        "model": model,
        "testPeriod": f"{test_start} to {test_end}",
        "directionAccuracy": round(float(direction_accuracy), 4),
        "alwaysUpAccuracy": round(float(always_up_accuracy), 4),
        "modelReturnRmse": round(float(model_return_rmse), 6),
        "naiveReturnRmse": round(float(naive_return_rmse), 6),
        "status": status,
    }
    validate_scorecard(card)
    return card


def placeholder_scorecard(symbol: str = config.TICKER) -> dict:
    """The stand-in the UI is built against until the real results are frozen."""
    return build_scorecard(
        symbol=symbol, model="LSTM, 30-day window", test_start="2024-01-02", test_end="2026-09-29",
        direction_accuracy=0.0, always_up_accuracy=0.0, model_return_rmse=0.0, naive_return_rmse=0.0,
        status="placeholder",
    )


def validate_scorecard(card: dict) -> None:
    """Raise ValueError if the card breaks the contract with the UI."""
    # Reject missing and extra keys so Python and UI consumers cannot drift silently.
    if set(card) != set(FIELDS):
        raise ValueError(f"Scorecard fields must be exactly {FIELDS}, got {tuple(card)}")
    if card["status"] not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}")
    for key in ("symbol", "model", "testPeriod"):
        if not isinstance(card[key], str) or not card[key]:
            raise ValueError(f"{key} must be a non-empty string")
    for key in ("directionAccuracy", "alwaysUpAccuracy"):
        if not 0.0 <= card[key] <= 1.0:
            raise ValueError(f"{key} must be a share between 0 and 1")
    for key in ("modelReturnRmse", "naiveReturnRmse"):
        if card[key] < 0:
            raise ValueError(f"{key} cannot be negative")


def write_scorecard(card: dict, path: Path = config.SCORECARD_JSON) -> Path:
    """Validate and write the scorecard as pretty JSON."""
    validate_scorecard(card)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(card, indent=2) + "\n", encoding="utf-8")
    return path
