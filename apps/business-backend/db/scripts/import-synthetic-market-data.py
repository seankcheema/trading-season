"""Import the 2026 synthetic market data archive into the business database."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import asyncpg
import duckdb


MARKET_TIMEZONE = ZoneInfo("America/Chicago")
DEFAULT_SESSION_ID = 2026001
DEFAULT_DATASET = Path(__file__).parents[1] / "seeds" / "synthetic-market-data-2026-v1"
STOCKS = (
    ("AAPL", "Apple Inc.", Decimal("224.15"), "Technology", 55_000_000, Decimal("0.22")),
    ("MSFT", "Microsoft Corporation", Decimal("430.10"), "Technology", 24_000_000, Decimal("0.20")),
    ("NVDA", "NVIDIA Corporation", Decimal("900.15"), "Technology", 48_000_000, Decimal("0.45")),
    ("AMZN", "Amazon.com, Inc.", Decimal("185.35"), "Consumer Discretionary", 36_000_000, Decimal("0.30")),
    ("GOOGL", "Alphabet Inc.", Decimal("165.70"), "Communication Services", 28_000_000, Decimal("0.26")),
    ("META", "Meta Platforms, Inc.", Decimal("510.40"), "Communication Services", 16_000_000, Decimal("0.34")),
    ("TSLA", "Tesla, Inc.", Decimal("250.00"), "Consumer Discretionary", 90_000_000, Decimal("0.55")),
    ("JPM", "JPMorgan Chase & Co.", Decimal("210.25"), "Financials", 9_500_000, Decimal("0.18")),
    ("XOM", "Exxon Mobil Corporation", Decimal("118.80"), "Energy", 15_000_000, Decimal("0.24")),
    ("UNH", "UnitedHealth Group Incorporated", Decimal("575.60"), "Health Care", 3_200_000, Decimal("0.19")),
)


def load_manifest(dataset: Path) -> dict[str, Any]:
    manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1:
        raise ValueError("Unsupported synthetic market data archive schema")
    for item in manifest["files"]:
        path = dataset / item["name"]
        if not path.is_file() or path.stat().st_size != item["bytes"]:
            raise ValueError(f"Dataset file missing or size changed: {item['name']}")
    return manifest


def validate_archive(dataset: Path, manifest: dict[str, Any]) -> tuple[int, int]:
    paths = [str(dataset / item["name"]) for item in manifest["files"]]
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
    if invalid or unique != count:
        raise ValueError(f"Invalid synthetic market data archive: {count=}, {invalid=}, {unique=}")
    return count, len(paths)


async def import_archive(database_url: str, dataset: Path, session_id: int) -> dict[str, int]:
    manifest = load_manifest(dataset)
    row_count, file_count = validate_archive(dataset, manifest)
    connection = await asyncpg.connect(database_url)
    try:
        async with connection.transaction():
            await connection.executemany(
                """
                INSERT INTO stocks
                    (symbol, company_name, starting_price, sector, average_volume, base_volatility)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (symbol) DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    starting_price = EXCLUDED.starting_price,
                    sector = EXCLUDED.sector,
                    average_volume = EXCLUDED.average_volume,
                    base_volatility = EXCLUDED.base_volatility
                """,
                STOCKS,
            )
            await connection.execute(
                """
                INSERT INTO simulation_sessions
                    (id, seed, drift, config, config_version, status, started_at, ended_at)
                VALUES ($1, $2, $3, $4::jsonb, 1, 'COMPLETED', to_timestamp($5), to_timestamp($6))
                ON CONFLICT (id) DO UPDATE SET
                    seed = EXCLUDED.seed,
                    drift = EXCLUDED.drift,
                    config = EXCLUDED.config,
                    config_version = EXCLUDED.config_version,
                    status = EXCLUDED.status,
                    started_at = EXCLUDED.started_at,
                    ended_at = EXCLUDED.ended_at,
                    failure_code = NULL,
                    failure_detail = NULL
                """,
                session_id,
                manifest["seed"],
                manifest["config"]["conditions"]["normal"]["drift"],
                json.dumps(manifest["config"]),
                manifest["start"],
                manifest["end"],
            )
            await connection.execute(
                "SELECT setval(pg_get_serial_sequence('simulation_sessions', 'id'), GREATEST((SELECT MAX(id) FROM simulation_sessions), $1))",
                session_id,
            )
            await connection.execute("DELETE FROM quotes WHERE session_id = $1", session_id)
            await connection.execute("DELETE FROM market_ticks WHERE session_id = $1", session_id)
            await connection.execute("DELETE FROM candles WHERE session_id = $1", session_id)
            await connection.execute("DELETE FROM market_behaviors WHERE session_id = $1", session_id)
            await connection.execute("DELETE FROM market_states WHERE session_id = $1", session_id)
            await connection.execute(
                """
                CREATE TEMP TABLE synthetic_market_candles (
                    symbol TEXT NOT NULL,
                    t BIGINT NOT NULL,
                    open DOUBLE PRECISION NOT NULL,
                    high DOUBLE PRECISION NOT NULL,
                    low DOUBLE PRECISION NOT NULL,
                    close DOUBLE PRECISION NOT NULL,
                    volume BIGINT NOT NULL
                ) ON COMMIT DROP
                """
            )
            with duckdb.connect(config={"threads": 2}) as db:
                for item in manifest["files"]:
                    cursor = db.execute(
                        """
                        SELECT symbol, t, open, high, low, close, volume
                        FROM read_parquet(?)
                        ORDER BY symbol, t
                        """,
                        [str(dataset / item["name"])],
                    )
                    while rows := cursor.fetchmany(10_000):
                        await connection.copy_records_to_table(
                            "synthetic_market_candles",
                            records=rows,
                            columns=["symbol", "t", "open", "high", "low", "close", "volume"],
                        )
            await connection.execute(
                """
                INSERT INTO candles
                    (session_id, symbol, "interval", "timestamp", open, high, low, close, volume, trade_count)
                SELECT $1, symbol, '1m', to_timestamp(t), open, high, low, close, volume, 1
                FROM synthetic_market_candles
                ORDER BY t, symbol
                """,
                session_id,
            )
            behavior_rows = []
            for event in manifest["events"]:
                duration = float(event["end"] - event["start"])
                for symbol in event["symbols"]:
                    behavior_rows.append(
                        (
                            session_id,
                            symbol,
                            event["condition"],
                            datetime.fromtimestamp(event["start"], MARKET_TIMEZONE),
                            duration,
                            event["strength"],
                        )
                    )
            await connection.executemany(
                """
                INSERT INTO market_behaviors
                    (session_id, symbol, behavior_type, start_time, duration_seconds, strength)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                behavior_rows,
            )
            await connection.executemany(
                """
                INSERT INTO market_states
                    (session_id, symbol, trend, volatility, liquidity, momentum)
                VALUES ($1, $2, 'uptrend', $3, 0.5000, 0.0000)
                """,
                [(session_id, symbol, volatility) for symbol, _, _, _, _, volatility in STOCKS],
            )
    finally:
        await connection.close()
    return {"files": file_count, "candles": row_count, "session_id": session_id}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", required=True, help="PostgreSQL URL for the business database.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET, help="Synthetic market data 2026-v1 archive directory.")
    parser.add_argument("--session-id", type=int, default=DEFAULT_SESSION_ID, help="Simulation session id to upsert.")
    parser.add_argument("--dry-run", action="store_true", help="Validate the archive without connecting to PostgreSQL.")
    args = parser.parse_args()

    manifest = load_manifest(args.dataset)
    row_count, file_count = validate_archive(args.dataset, manifest)
    if args.dry_run:
        print(f"Validated synthetic market data archive: {file_count} files, {row_count} candles.")
        return

    result = await import_archive(args.database_url, args.dataset, args.session_id)
    print(
        "Imported synthetic market data archive: "
        f"{result['files']} files, {result['candles']} candles, session_id={result['session_id']}."
    )


if __name__ == "__main__":
    asyncio.run(main())
