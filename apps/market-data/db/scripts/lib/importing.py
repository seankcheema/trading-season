from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Callable

import asyncpg
import duckdb

from .common import DEFAULT_SESSION_ID, SESSION_SECONDS, STOCKS, session_open
from .validation import load_manifest, validate_archive

TICK_PERSISTENT_BYTES = 512
CANDLE_PERSISTENT_BYTES = 384
TICK_WORKING_BYTES = 256
CANDLE_WORKING_BYTES = 192
DISK_SAFETY_FACTOR = 1.25
GIB = 1024**3


@dataclass(frozen=True, slots=True)
class MonthFiles:
    key: str
    tick_files: tuple[dict[str, Any], ...]
    candle_files: tuple[dict[str, Any], ...]
    first_day: date
    last_day: date
    tick_count: int
    candle_count: int
    fingerprint: str


@dataclass(frozen=True, slots=True)
class DiskEstimate:
    available_bytes: int
    persistent_bytes: int
    working_bytes: int
    required_bytes: int
    source: str


def group_archive_months(manifest: dict[str, Any]) -> list[MonthFiles]:
    ticks: dict[str, list[dict[str, Any]]] = {}
    candles: dict[str, list[dict[str, Any]]] = {}
    for item in manifest["tick_files"]:
        ticks.setdefault(item["day"][:7], []).append(item)
    for item in manifest["candle_files"]:
        candles.setdefault(item["day"][:7], []).append(item)
    if ticks.keys() != candles.keys():
        raise ValueError("Tick and candle archive months do not match")
    symbol_count = len(manifest["symbols"])
    result = []
    for key in sorted(ticks):
        tick_files = tuple(sorted(ticks[key], key=lambda item: item["day"]))
        candle_files = tuple(sorted(candles[key], key=lambda item: item["day"]))
        tick_days = [item["day"] for item in tick_files]
        if tick_days != [item["day"] for item in candle_files]:
            raise ValueError(f"Tick and candle days do not match for {key}")
        payload = {"ticks": tick_files, "candles": candle_files}
        fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        result.append(MonthFiles(
            key=key,
            tick_files=tick_files,
            candle_files=candle_files,
            first_day=date.fromisoformat(tick_days[0]),
            last_day=date.fromisoformat(tick_days[-1]),
            tick_count=len(tick_files) * SESSION_SECONDS * symbol_count,
            candle_count=len(candle_files) * 390 * symbol_count,
            fingerprint=fingerprint,
        ))
    return result


def normalize_tick_storage(value: str) -> str:
    normalized = value.lower()
    if normalized not in {"parquet", "postgres"}:
        raise ValueError("tick storage must be 'parquet' or 'postgres'")
    return normalized


def estimate_disk(months: list[MonthFiles], available_bytes: int, source: str,
                  tick_storage: str = "parquet") -> DiskEstimate:
    tick_storage = normalize_tick_storage(tick_storage)
    persistent = sum(
        month.candle_count * CANDLE_PERSISTENT_BYTES
        + (month.tick_count * TICK_PERSISTENT_BYTES if tick_storage == "postgres" else 0)
        for month in months
    )
    working = max((
        month.candle_count * CANDLE_WORKING_BYTES
        + (month.tick_count * TICK_WORKING_BYTES if tick_storage == "postgres" else 0)
        for month in months
    ), default=0)
    required = math.ceil((persistent + working) * DISK_SAFETY_FACTOR)
    return DiskEstimate(available_bytes, persistent, working, required, source)


def format_disk_estimate(estimate: DiskEstimate) -> str:
    return (f"available={estimate.available_bytes/GIB:.2f} GiB, "
            f"estimated persistent growth={estimate.persistent_bytes/GIB:.2f} GiB, "
            f"monthly working space={estimate.working_bytes/GIB:.2f} GiB, "
            f"required with safety margin={estimate.required_bytes/GIB:.2f} GiB "
            f"({estimate.source})")


def require_disk_space(estimate: DiskEstimate) -> None:
    if estimate.available_bytes < estimate.required_bytes:
        raise ValueError(f"Insufficient PostgreSQL disk space: {format_disk_estimate(estimate)}")


async def _available_disk(connection: asyncpg.Connection, override_gb: float | None,
                          initial_database_size: int, override_initial_free: int | None) -> tuple[int, str, int | None]:
    if override_gb is not None:
        initial_free = override_initial_free if override_initial_free is not None else int(override_gb * GIB)
        current_size = await connection.fetchval("SELECT pg_database_size(current_database())")
        growth = max(0, int(current_size) - initial_database_size)
        return max(0, initial_free - growth), "operator-provided server capacity", initial_free
    try:
        data_directory_value = await connection.fetchval("SHOW data_directory")
    except asyncpg.InsufficientPrivilegeError as error:
        raise ValueError(
            "The PostgreSQL user cannot inspect data_directory. Determine the free space on the "
            "database server, then pass --available-disk-gb or set MARKET_DATA_AVAILABLE_DISK_GB. "
            "No monthly market-data transaction was started."
        ) from error
    data_directory = Path(data_directory_value)
    if not data_directory.exists():
        raise ValueError(
            "Cannot inspect free space for PostgreSQL data_directory "
            f"{data_directory}. Pass --available-disk-gb or set MARKET_DATA_AVAILABLE_DISK_GB."
        )
    return shutil.disk_usage(data_directory).free, f"filesystem containing {data_directory}", None


def _configured_available_gb(value: float | None) -> float | None:
    raw = value if value is not None else os.getenv("MARKET_DATA_AVAILABLE_DISK_GB")
    if raw in (None, ""):
        return None
    parsed = float(raw)
    if not math.isfinite(parsed) or parsed <= 0:
        raise ValueError("Available database disk space must be a positive number of GiB")
    return parsed


async def _copy(connection: asyncpg.Connection, dataset: Path, files: tuple[dict[str, Any], ...],
                table: str, columns: list[str]) -> None:
    with duckdb.connect() as db:
        for item in files:
            cursor = db.execute(f"SELECT {','.join(columns)} FROM read_parquet(?)", [str(dataset / item["name"])])
            while rows := cursor.fetchmany(25_000):
                await connection.copy_records_to_table(table, records=rows, columns=columns)


async def _verify_month(connection: asyncpg.Connection, session_id: int, month: MonthFiles,
                        tick_storage: str) -> None:
    start = session_open(month.first_day)
    end = session_open(month.last_day) + SESSION_SECONDS
    tick = await connection.fetchrow("""SELECT count(*) AS rows, min("timestamp") AS first_at,
        max("timestamp") AS last_at FROM market_ticks WHERE session_id=$1 AND "timestamp">=to_timestamp($2)
        AND "timestamp"<to_timestamp($3)""", session_id, start, end)
    candle = await connection.fetchrow("""SELECT count(*) AS rows, min("timestamp") AS first_at,
        max("timestamp") AS last_at FROM candles WHERE session_id=$1 AND "timestamp">=to_timestamp($2)
        AND "timestamp"<to_timestamp($3)""", session_id, start, end)
    expected_last_candle = end - 60
    expected_database_ticks = month.tick_count if tick_storage == "postgres" else 0
    ticks_valid = tick["rows"] == expected_database_ticks
    if tick_storage == "postgres":
        ticks_valid = (ticks_valid and int(tick["first_at"].timestamp()) == start
                       and int(tick["last_at"].timestamp()) == end - 1)
    if (not ticks_valid or candle["rows"] != month.candle_count
            or int(candle["first_at"].timestamp()) != start
            or int(candle["last_at"].timestamp()) != expected_last_candle):
        raise ValueError(f"Database rows do not match checkpoint metadata for {month.key}")


async def _prepare_session(connection: asyncpg.Connection, manifest: dict[str, Any], session_id: int,
                           fingerprint: str, replace: bool, tick_storage: str,
                           archive_location: str) -> dict[str, Any]:
    async with connection.transaction():
        existing = await connection.fetchrow("SELECT status,config FROM simulation_sessions WHERE id=$1 FOR UPDATE", session_id)
        old_config = existing["config"] if existing else None
        if isinstance(old_config, str):
            old_config = json.loads(old_config)
        old_fingerprint = (old_config or {}).get("archive_fingerprint")
        old_storage = (old_config or {}).get("tick_storage", {}).get("mode")
        if (existing and existing["status"] == "COMPLETED" and old_fingerprint == fingerprint
                and old_storage == tick_storage):
            return {"skip": True, "config": old_config}
        resumable = (existing and not replace and existing["status"] == "RUNNING"
                     and old_fingerprint == fingerprint and old_storage == tick_storage
                     and "import_checkpoint" in (old_config or {}))
        if existing and not resumable and not replace:
            raise ValueError("Session has different, completed, or non-resumable contents; pass --replace")
        if existing and not resumable:
            await connection.execute("DELETE FROM simulation_sessions WHERE id=$1", session_id)
            existing = None
        await connection.executemany("""INSERT INTO stocks(symbol,company_name,starting_price,sector,average_volume,base_volatility)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(symbol) DO UPDATE SET company_name=excluded.company_name,
          starting_price=excluded.starting_price,sector=excluded.sector,average_volume=excluded.average_volume,base_volatility=excluded.base_volatility""",
          [(s.symbol,s.company_name,s.starting_price,s.sector,s.average_volume,s.base_volatility) for s in STOCKS])
        if resumable:
            return {"skip": False, "config": old_config}
        config = manifest["config"] | {
            "dataset_id": manifest["dataset_id"],
            "archive_fingerprint": fingerprint,
            "tick_storage": {
                "mode": tick_storage,
                "archive_location": archive_location,
                "archived_ticks": manifest["tick_count"],
                "database_ticks": manifest["tick_count"] if tick_storage == "postgres" else 0,
            },
            "import_checkpoint": {"completed_months": {}},
        }
        await connection.execute("""INSERT INTO simulation_sessions(id,seed,drift,config,config_version,status,started_at,ended_at)
          VALUES($1,$2,$3,$4::jsonb,1,'RUNNING',to_timestamp($5),NULL)""", session_id, manifest["seed"],
          manifest["config"]["conditions"]["normal"]["drift"], json.dumps(config), manifest["start"])
        await connection.execute("SELECT setval(pg_get_serial_sequence('simulation_sessions','id'),GREATEST((SELECT max(id) FROM simulation_sessions),$1))", session_id)
        return {"skip": False, "config": config}


async def import_archive(database_url: str, dataset: Path, session_id: int = DEFAULT_SESSION_ID,
                         replace: bool = False, progress: Callable[[int, int, str], None] | None = None,
                         validated_counts: dict[str, int] | None = None, available_disk_gb: float | None = None,
                         fail_after_month: str | None = None, tick_storage: str = "parquet") -> dict[str, Any]:
    report = progress or (lambda current, total, label: None)
    manifest = load_manifest(dataset)
    counts = validated_counts or validate_archive(dataset, manifest, progress)
    fingerprint = manifest["fingerprint"]
    months = group_archive_months(manifest)
    tick_storage = normalize_tick_storage(tick_storage)
    archive_location = str(dataset.resolve())
    available_disk_gb = _configured_available_gb(available_disk_gb)
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute("SELECT pg_advisory_lock($1)", session_id)
        prepared = await _prepare_session(
            connection, manifest, session_id, fingerprint, replace, tick_storage, archive_location)
        if prepared["skip"]:
            for month in months:
                await _verify_month(connection, session_id, month, tick_storage)
            return counts | {"session_id": session_id, "skipped": True, "completed_months": len(months),
                             "archived_ticks": counts["ticks"], "database_ticks": counts["ticks"] if tick_storage == "postgres" else 0}
        config = prepared["config"]
        completed: dict[str, Any] = config["import_checkpoint"]["completed_months"]
        by_key = {month.key: month for month in months}
        month_positions = {month.key: index for index, month in enumerate(months, 1)}
        for key, checkpoint in completed.items():
            month = by_key.get(key)
            if (not month or checkpoint.get("fingerprint") != month.fingerprint
                    or checkpoint.get("storage_mode") != tick_storage
                    or checkpoint.get("archived_ticks") != month.tick_count
                    or checkpoint.get("database_ticks") != (month.tick_count if tick_storage == "postgres" else 0)
                    or checkpoint.get("candles") != month.candle_count):
                raise ValueError(f"Stored checkpoint does not match archive month {key}")
            await _verify_month(connection, session_id, month, tick_storage)
            position = month_positions[key]
            report(4, 4, f"Month {position}/{len(months)} {key}: verified and skipped")
        pending = [month for month in months if month.key not in completed]
        initial_database_size = int(await connection.fetchval("SELECT pg_database_size(current_database())"))
        override_initial_free: int | None = None
        for month in pending:
            position = month_positions[month.key]
            prefix = f"Month {position}/{len(months)} {month.key}"
            report(0, 4, f"{prefix}: checking PostgreSQL free space")
            available, source, override_initial_free = await _available_disk(
                connection, available_disk_gb, initial_database_size, override_initial_free)
            remaining = [item for item in months if item.key not in completed]
            disk = estimate_disk(remaining, available, source, tick_storage)
            report(0, 4, f"{prefix}: disk check ({disk.available_bytes/GIB:.1f} GiB free, {disk.required_bytes/GIB:.1f} GiB required)")
            require_disk_space(disk)
            async with connection.transaction():
                if tick_storage == "postgres":
                    await connection.execute("""CREATE TEMP TABLE import_ticks(symbol text,t bigint,price numeric(18,6),bid numeric(18,6),ask numeric(18,6),bid_size integer,ask_size integer,trade_volume integer,sequence_number bigint) ON COMMIT DROP""")
                await connection.execute("""CREATE TEMP TABLE import_candles(symbol text,t bigint,open numeric(18,6),high numeric(18,6),low numeric(18,6),close numeric(18,6),volume bigint,trade_count integer) ON COMMIT DROP""")
                load_label = "tick and candle partitions" if tick_storage == "postgres" else "candle partitions"
                report(1, 4, f"{prefix}: loading {load_label}")
                tick_cols = ["symbol", "t", "price", "bid", "ask", "bid_size", "ask_size", "trade_volume", "sequence_number"]
                candle_cols = ["symbol", "t", "open", "high", "low", "close", "volume", "trade_count"]
                if tick_storage == "postgres":
                    await _copy(connection, dataset, month.tick_files, "import_ticks", tick_cols)
                await _copy(connection, dataset, month.candle_files, "import_candles", candle_cols)
                if tick_storage == "postgres":
                    report(2, 4, f"{prefix}: inserting {month.tick_count:,} ticks")
                    await connection.execute("""INSERT INTO market_ticks(session_id,symbol,"timestamp",price,bid,ask,bid_size,ask_size,trade_volume,sequence_number)
                      SELECT $1,symbol,to_timestamp(t),price,bid,ask,bid_size,ask_size,trade_volume,sequence_number FROM import_ticks""", session_id)
                else:
                    report(2, 4, f"{prefix}: retaining {month.tick_count:,} ticks in Parquet")
                report(3, 4, f"{prefix}: inserting {month.candle_count:,} candles and verifying")
                await connection.execute("""INSERT INTO candles(session_id,symbol,"interval","timestamp",open,high,low,close,volume,trade_count)
                  SELECT $1,symbol,'1m',to_timestamp(t),open,high,low,close,volume,trade_count FROM import_candles""", session_id)
                await _verify_month(connection, session_id, month, tick_storage)
                if fail_after_month == month.key:
                    raise RuntimeError(f"Injected failure for {month.key}")
                completed[month.key] = {
                    "fingerprint": month.fingerprint,
                    "storage_mode": tick_storage,
                    "archived_ticks": month.tick_count,
                    "database_ticks": month.tick_count if tick_storage == "postgres" else 0,
                    "candles": month.candle_count,
                }
                await connection.execute("UPDATE simulation_sessions SET config=$2::jsonb WHERE id=$1", session_id, json.dumps(config))
            report(4, 4, f"{prefix}: committed")
        async with connection.transaction():
            tick_count = await connection.fetchval("SELECT count(*) FROM market_ticks WHERE session_id=$1", session_id)
            candle_count = await connection.fetchval("SELECT count(*) FROM candles WHERE session_id=$1", session_id)
            expected_database_ticks = counts["ticks"] if tick_storage == "postgres" else 0
            if tick_count != expected_database_ticks or candle_count != counts["candles"]:
                raise ValueError("Final database counts do not match the validated archive")
            await connection.execute("DELETE FROM market_behaviors WHERE session_id=$1", session_id)
            await connection.execute("DELETE FROM market_states WHERE session_id=$1", session_id)
            behaviors = [(session_id, symbol, event["condition"], event["start"], float(event["end"]-event["start"]), event["strength"])
                         for event in manifest["events"] for symbol in event["symbols"]]
            await connection.executemany("INSERT INTO market_behaviors(session_id,symbol,behavior_type,start_time,duration_seconds,strength) VALUES($1,$2,$3,to_timestamp($4),$5,$6)", behaviors)
            await connection.executemany("INSERT INTO market_states(session_id,symbol,trend,volatility,liquidity,momentum) VALUES($1,$2,'uptrend',$3,0.5,0)", [(session_id,s.symbol,s.base_volatility) for s in STOCKS])
            await connection.execute("UPDATE simulation_sessions SET status='COMPLETED',ended_at=to_timestamp($2),config=$3::jsonb WHERE id=$1", session_id, manifest["end"], json.dumps(config))
        report(1, 1, f"database import complete: {len(months)} monthly checkpoints")
        return counts | {"session_id": session_id, "skipped": False, "completed_months": len(months),
                         "archived_ticks": counts["ticks"], "database_ticks": expected_database_ticks}
    finally:
        await connection.close()
