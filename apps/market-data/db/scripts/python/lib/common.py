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
DB_ROOT = SCRIPTS.parents[1]
DEFAULT_DATASET = DB_ROOT / "seeds" / "synthetic-market-data-2026-v1"
DEFAULT_CONFIG = SCRIPTS / "config" / "synthetic-market-data-2026-v1.json"

@dataclass(frozen=True, slots=True)
class Stock:
    """One simulated price series and the instrument it prices (BR-12).

    The simulator keys every price table on ``symbol`` (at most five characters),
    so an FX pair or crypto asset is simulated under a short symbol and traded
    under its full ``ticker``. Every series is quoted in US dollars on the one
    simulated session; the instrument's ``market`` is set for equities only,
    as the schema requires.
    """
    symbol: str
    company_name: str
    starting_price: Decimal
    sector: str
    average_volume: int
    base_volatility: Decimal
    asset_class: str = "Equity"
    market: str | None = "US"
    currency: str = "USD"
    ticker: str | None = None

    @property
    def instrument_ticker(self) -> str:
        return self.ticker or self.symbol

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
    # UK equities, quoted in US dollars.
    Stock("VOD", "Vodafone Group Plc", Decimal("9.45"), "Telecommunications", 4_500_000, Decimal("0.24"), market="UK"),
    Stock("HSBA", "HSBC Holdings plc", Decimal("42.30"), "Financials", 2_800_000, Decimal("0.21"), market="UK"),
    Stock("BP", "BP p.l.c.", Decimal("31.60"), "Energy", 6_000_000, Decimal("0.25"), market="UK"),
    # Indian equities, quoted in US dollars.
    Stock("RELI", "Reliance Industries Limited", Decimal("34.80"), "Energy", 3_000_000, Decimal("0.27"), market="IN"),
    Stock("TCS", "Tata Consultancy Services Limited", Decimal("47.90"), "Information Technology", 1_900_000, Decimal("0.23"), market="IN"),
    Stock("INFY", "Infosys Limited", Decimal("18.20"), "Information Technology", 5_200_000, Decimal("0.26"), market="IN"),
    # Foreign exchange: one unit of the base currency in US dollars.
    Stock("EUR", "Euro / US Dollar", Decimal("1.0850"), "Foreign Exchange", 20_000_000, Decimal("0.08"),
          asset_class="FX", market=None, ticker="EURUSD"),
    Stock("GBP", "British Pound / US Dollar", Decimal("1.2700"), "Foreign Exchange", 12_000_000, Decimal("0.09"),
          asset_class="FX", market=None, ticker="GBPUSD"),
    Stock("INR", "Indian Rupee / US Dollar", Decimal("0.0120"), "Foreign Exchange", 8_000_000, Decimal("0.05"),
          asset_class="FX", market=None, ticker="INRUSD"),
    # Crypto assets in US dollars.
    Stock("BTC", "Bitcoin / US Dollar", Decimal("65000.00"), "Crypto Assets", 1_200_000, Decimal("0.65"),
          asset_class="Crypto", market=None, ticker="BTCUSD"),
    Stock("ETH", "Ether / US Dollar", Decimal("3200.00"), "Crypto Assets", 2_500_000, Decimal("0.75"),
          asset_class="Crypto", market=None, ticker="ETHUSD"),
    Stock("SOL", "Solana / US Dollar", Decimal("150.00"), "Crypto Assets", 3_800_000, Decimal("0.90"),
          asset_class="Crypto", market=None, ticker="SOLUSD"),
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
