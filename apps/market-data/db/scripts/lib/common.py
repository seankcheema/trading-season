from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

MARKET_TIMEZONE = ZoneInfo("America/Chicago")
SESSION_SECONDS = 390 * 60
DEFAULT_SESSION_ID = 2026001
SCRIPTS = Path(__file__).parents[1]
DB_ROOT = SCRIPTS.parent
DEFAULT_DATASET = DB_ROOT / "seeds" / "synthetic-market-data-2026-v1"
DEFAULT_CONFIG = SCRIPTS / "config" / "synthetic-market-data-2026-v1.json"

@dataclass(frozen=True, slots=True)
class Stock:
    symbol: str
    company_name: str
    starting_price: Decimal
    sector: str
    average_volume: int
    base_volatility: Decimal

STOCKS = (
    Stock("AAPL", "Apple Inc.", Decimal("224.15"), "Technology", 55_000_000, Decimal("0.22")),
    Stock("AMZN", "Amazon.com, Inc.", Decimal("185.35"), "Consumer Discretionary", 36_000_000, Decimal("0.30")),
    Stock("GOOGL", "Alphabet Inc.", Decimal("165.70"), "Communication Services", 28_000_000, Decimal("0.26")),
    Stock("JPM", "JPMorgan Chase & Co.", Decimal("210.25"), "Financials", 9_500_000, Decimal("0.18")),
    Stock("META", "Meta Platforms, Inc.", Decimal("510.40"), "Communication Services", 16_000_000, Decimal("0.34")),
    Stock("MSFT", "Microsoft Corporation", Decimal("430.10"), "Technology", 24_000_000, Decimal("0.20")),
    Stock("NVDA", "NVIDIA Corporation", Decimal("900.15"), "Technology", 48_000_000, Decimal("0.45")),
    Stock("TSLA", "Tesla, Inc.", Decimal("250.00"), "Consumer Discretionary", 90_000_000, Decimal("0.55")),
    Stock("UNH", "UnitedHealth Group Incorporated", Decimal("575.60"), "Health Care", 3_200_000, Decimal("0.19")),
    Stock("XOM", "Exxon Mobil Corporation", Decimal("118.80"), "Energy", 15_000_000, Decimal("0.24")),
)

def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

def session_open(day: date) -> int:
    return int(datetime(day.year, day.month, day.day, 8, 30, tzinfo=MARKET_TIMEZONE).timestamp())

def weekdays(start: date, end: date) -> list[date]:
    result = []
    current = start
    while current <= end:
        if current.weekday() < 5:
            result.append(current)
        current += timedelta(days=1)
    return result

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def archive_fingerprint(manifest: dict[str, Any]) -> str:
    value = {key: manifest[key] for key in ("dataset_id", "config", "sessions", "tick_files", "candle_files")}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
