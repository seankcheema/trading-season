"""Generate the local 2026-v1 synthetic market data archive."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import duckdb
import numpy as np


MARKET_TIMEZONE = ZoneInfo("America/Chicago")
DEFAULT_DATASET = Path(__file__).parents[1] / "seeds" / "synthetic-market-data-2026-v1"
DEFAULT_CONFIG = Path(__file__).with_name("synthetic-market-data-2026-v1.json")


@dataclass(frozen=True, slots=True)
class SyntheticStock:
    symbol: str
    company_name: str
    starting_price: Decimal
    sector: str
    average_volume: int
    base_volatility: Decimal


STOCKS = (
    SyntheticStock("AAPL", "Apple Inc.", Decimal("224.15"), "Technology", 55_000_000, Decimal("0.22")),
    SyntheticStock("MSFT", "Microsoft Corporation", Decimal("430.10"), "Technology", 24_000_000, Decimal("0.20")),
    SyntheticStock("NVDA", "NVIDIA Corporation", Decimal("900.15"), "Technology", 48_000_000, Decimal("0.45")),
    SyntheticStock("AMZN", "Amazon.com, Inc.", Decimal("185.35"), "Consumer Discretionary", 36_000_000, Decimal("0.30")),
    SyntheticStock("GOOGL", "Alphabet Inc.", Decimal("165.70"), "Communication Services", 28_000_000, Decimal("0.26")),
    SyntheticStock("META", "Meta Platforms, Inc.", Decimal("510.40"), "Communication Services", 16_000_000, Decimal("0.34")),
    SyntheticStock("TSLA", "Tesla, Inc.", Decimal("250.00"), "Consumer Discretionary", 90_000_000, Decimal("0.55")),
    SyntheticStock("JPM", "JPMorgan Chase & Co.", Decimal("210.25"), "Financials", 9_500_000, Decimal("0.18")),
    SyntheticStock("XOM", "Exxon Mobil Corporation", Decimal("118.80"), "Energy", 15_000_000, Decimal("0.24")),
    SyntheticStock("UNH", "UnitedHealth Group Incorporated", Decimal("575.60"), "Health Care", 3_200_000, Decimal("0.19")),
)


def session_open(day: date) -> int:
    return int(datetime(day.year, day.month, day.day, 8, 30, tzinfo=MARKET_TIMEZONE).timestamp())


def trading_days(year: int) -> list[date]:
    day = date(year, 1, 1)
    days = []
    while day.year == year:
        if day.weekday() < 5:
            days.append(day)
        day += timedelta(days=1)
    return days


def load_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def events_for(config: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for overlay, items in ((False, config["schedule"]), (True, config["overlays"])):
        for event in items:
            params = config["conditions"][event["condition"]]
            result.append(
                event
                | {
                    "start_date": event["start"],
                    "end_date_exclusive": event["end"],
                    "start": session_open(date.fromisoformat(event["start"])),
                    "end": session_open(date.fromisoformat(event["end"])),
                    "overlay": overlay,
                    "symbols": [stock.symbol for stock in STOCKS],
                    "strength": params["strength"],
                    "parameters": params,
                }
            )
    return sorted(result, key=lambda event: event["start"])


def generate_day(
    day: date,
    prices: dict[str, float],
    anchors: dict[str, float],
    active_ids: dict[str, str],
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    event = next(
        event for event in config["schedule"] if event["start"] <= day.isoformat() < event["end"]
    )
    params = config["conditions"][event["condition"]]
    overlays = [
        event for event in config["overlays"] if event["start"] <= day.isoformat() < event["end"]
    ]
    samples = config["samples_per_minute"]
    point_count = 390 * samples
    dt = 1 / (252 * 390 * samples)
    shared = np.random.default_rng(
        np.random.SeedSequence([config["seed"], day.toordinal(), 999])
    ).normal(size=point_count)
    rows = []

    for index, stock in enumerate(STOCKS):
        rng = np.random.default_rng(np.random.SeedSequence([config["seed"], day.toordinal(), index]))
        if active_ids.get(stock.symbol) != event["id"]:
            anchors[stock.symbol] = prices[stock.symbol]
            active_ids[stock.symbol] = event["id"]

        response = 0.85 + (0.03 * index)
        sigma = float(stock.base_volatility) * params["volatility_multiplier"] * response
        volume_factor = params["volume_multiplier"]
        for overlay in overlays:
            overlay_params = config["conditions"][overlay["condition"]]
            sigma *= overlay_params["volatility_multiplier"]
            volume_factor *= overlay_params["volume_multiplier"]

        drift = (params["drift"] * response) + (
            params["reversion"] * np.log(anchors[stock.symbol] / prices[stock.symbol])
        )
        noise = (0.45 * shared) + (np.sqrt(1 - 0.45**2) * rng.normal(size=point_count))
        path = prices[stock.symbol] * np.exp(
            np.cumsum(((drift - (0.5 * sigma * sigma)) * dt) + (sigma * np.sqrt(dt) * noise))
        )
        curve = np.linspace(-1, 1, 390)
        shape = 0.7 + (curve * curve)
        shape /= shape.mean()
        volumes = rng.poisson((stock.average_volume / 390) * volume_factor * shape)
        opening = prices[stock.symbol]
        start = session_open(day)

        for minute, sample in enumerate(path.reshape(390, samples)):
            close = float(sample[-1])
            rows.append(
                {
                    "symbol": stock.symbol,
                    "t": start + (minute * 60),
                    "session_start": start,
                    "open": opening,
                    "high": max(opening, float(sample.max())),
                    "low": min(opening, float(sample.min())),
                    "close": close,
                    "volume": int(volumes[minute]),
                }
            )
            opening = close
        prices[stock.symbol] = opening

    return rows


def validate(root: Path, files: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    paths = [str(root / item["name"]) for item in files]
    with duckdb.connect(config={"threads": 2}) as db:
        count, invalid, unique = db.execute(
            """
            SELECT count(*),
                   count(*) FILTER (WHERE
                       NOT isfinite(open) OR NOT isfinite(high)
                       OR NOT isfinite(low) OR NOT isfinite(close)
                       OR low <= 0 OR high < greatest(open, close)
                       OR low > least(open, close) OR volume < 0
                       OR t < session_start OR t >= session_start + 23400
                       OR (t - session_start) % 60 <> 0),
                   count(DISTINCT (symbol, t))
            FROM read_parquet(?)
            """,
            [paths],
        ).fetchone()
        expected = len(trading_days(config["year"])) * 390 * len(STOCKS)
        if count != expected or invalid or unique != count:
            raise ValueError(f"Coverage/OHLCV validation failed: {count=}, {invalid=}, {unique=}")

        continuity = db.execute(
            """
            SELECT count(*)
            FROM (
                SELECT open, lag(close) OVER (PARTITION BY symbol ORDER BY t) AS previous
                FROM read_parquet(?)
            )
            WHERE previous IS NOT NULL AND abs(open - previous) > 0.0000001
            """,
            [paths],
        ).fetchone()[0]
        if continuity:
            raise ValueError("Discontinuous prices")

        metrics = []
        for event in events_for(config):
            rows = db.execute(
                """
                SELECT symbol,
                       last(close ORDER BY t) / first(open ORDER BY t) - 1,
                       stddev_pop(ln(close / open))
                FROM read_parquet(?)
                WHERE t >= ? AND t < ?
                GROUP BY symbol
                ORDER BY symbol
                """,
                [paths, event["start"], event["end"]],
            ).fetchall()
            for symbol, return_value, volatility in rows:
                if event["condition"] == "uptrend" and return_value <= 0:
                    raise ValueError(f"{symbol} did not rise in {event['id']}")
                if event["condition"] == "downtrend" and return_value >= 0:
                    raise ValueError(f"{symbol} did not fall in {event['id']}")
                metrics.append(
                    {
                        "event": event["id"],
                        "symbol": symbol,
                        "return_pct": return_value * 100,
                        "minute_volatility": volatility,
                    }
                )

        for spike in [event for event in events_for(config) if event["overlay"]]:
            for stock in STOCKS:
                spike_volatility = next(
                    metric["minute_volatility"]
                    for metric in metrics
                    if metric["event"] == spike["id"] and metric["symbol"] == stock.symbol
                )
                baseline = next(
                    event
                    for event in events_for(config)
                    if not event["overlay"] and event["start"] <= spike["start"] < event["end"]
                )
                base_volatility = db.execute(
                    """
                    SELECT stddev_pop(ln(close / open))
                    FROM read_parquet(?)
                    WHERE symbol = ?
                      AND t >= ?
                      AND t < ?
                      AND NOT (t >= ? AND t < ?)
                    """,
                    [paths, stock.symbol, baseline["start"], baseline["end"], spike["start"], spike["end"]],
                ).fetchone()[0]
                if spike_volatility <= base_volatility * 2:
                    raise ValueError("Volatility spike not distinguishable")

    return {
        "rows": count,
        "unique_rows": unique,
        "invalid_rows": invalid,
        "scenario_metrics": metrics,
    }


def generate(root: Path = DEFAULT_DATASET, config_path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    config = load_config(config_path)
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        if existing["config"] != config:
            raise ValueError("Existing dataset config differs; use a new output directory")
        print("Synthetic market data archive already exists; no changes made.", flush=True)
        return existing

    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".generation.lock"
    file_descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.close(file_descriptor)
    try:
        prices = {stock.symbol: float(stock.starting_price) for stock in STOCKS}
        anchors: dict[str, float] = {}
        active_ids: dict[str, str] = {}
        files = []
        days = trading_days(config["year"])
        with duckdb.connect(config={"threads": 2}) as db:
            for index, day in enumerate(days):
                rows = generate_day(day, prices, anchors, active_ids, config)
                source = root / "day.tmp.json"
                temp = root / "day.tmp.parquet"
                source.write_text(json.dumps(rows), encoding="utf-8")
                db.read_json(str(source)).create_view("day_bars", replace=True)
                db.execute(
                    "COPY (SELECT * FROM day_bars ORDER BY symbol, t) TO ? (FORMAT PARQUET, COMPRESSION ZSTD)",
                    [str(temp)],
                )
                target = root / f"{day}.parquet"
                temp.replace(target)
                files.append(
                    {
                        "name": target.name,
                        "day": str(day),
                        "bytes": target.stat().st_size,
                        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                    }
                )
                if index % 20 == 0:
                    print(f"Generated {index + 1}/{len(days)} sessions", flush=True)

        (root / "day.tmp.json").unlink(missing_ok=True)
        print("Validating full coverage, scenarios, and continuity...", flush=True)
        report = validate(root, files, config)
        manifest = {
            "schema_version": 1,
            "dataset_id": config["version"],
            "seed": config["seed"],
            "config": config,
            "start": session_open(days[0]),
            "end": session_open(days[-1]) + (390 * 60),
            "sessions": [str(day) for day in days],
            "symbols": [
                {
                    "symbol": stock.symbol,
                    "name": stock.company_name,
                    "response_multiplier": 0.85 + (0.03 * index),
                    "base_volatility": float(stock.base_volatility),
                }
                for index, stock in enumerate(STOCKS)
            ],
            "events": events_for(config),
            "files": files,
            "validation": report,
            "archive_bytes": sum(item["bytes"] for item in files),
            "rows": report["rows"],
            "calendar": "Weekdays including holidays, 08:30-15:00 America/Chicago",
            "provenance": "Generated locally by the trading-season synthetic market data generator",
        }
        temp_manifest = root / "manifest.tmp.json"
        temp_manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        temp_manifest.replace(manifest_path)
        print(
            f"Published {report['rows']:,} candles, {manifest['archive_bytes'] / 1e6:.2f} MB at {root}",
            flush=True,
        )
        return manifest
    finally:
        lock.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_DATASET, help="Archive output directory.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Generator config JSON.")
    args = parser.parse_args()
    generate(args.output, args.config)


if __name__ == "__main__":
    main()
