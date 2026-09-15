from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Callable

import duckdb

from .common import SESSION_SECONDS, archive_fingerprint, session_open, sha256

def load_manifest(dataset: Path, *, allow_candle_only: bool = False) -> dict[str, Any]:
    path = dataset / "manifest.json"
    if not path.is_file():
        raise ValueError(f"Missing archive manifest: {path}")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if "tick_files" not in manifest:
        if allow_candle_only:
            return manifest
        raise ValueError("Candle-only 2026-v1 archive detected; run generation with --regenerate")
    if manifest.get("schema_version") != 2 or manifest.get("dataset_id") != "2026-v1":
        raise ValueError("Unsupported synthetic market-data archive")
    for group in ("tick_files", "candle_files"):
        for item in manifest[group]:
            file = dataset / item["name"]
            if not file.is_file() or file.stat().st_size != item["bytes"] or sha256(file) != item["sha256"]:
                raise ValueError(f"Archive file missing or corrupt: {item['name']}")
    return manifest

def validate_archive(dataset: Path, manifest: dict[str, Any] | None = None,
                     progress: Callable[[int, int, str], None] | None = None) -> dict[str, int]:
    manifest = manifest or load_manifest(dataset)
    ticks = [str(dataset / item["name"]) for item in manifest["tick_files"]]
    candles = [str(dataset / item["name"]) for item in manifest["candle_files"]]
    expected_ticks = len(manifest["sessions"]) * 390 * 60 * len(manifest["symbols"])
    expected_candles = len(manifest["sessions"]) * 390 * len(manifest["symbols"])
    report = progress or (lambda current, total, label: None)
    with duckdb.connect() as db:
        db.execute("CREATE TEMP TABLE expected_sessions(session_start BIGINT, day_index INTEGER)")
        db.executemany("INSERT INTO expected_sessions VALUES (?, ?)",
                       [(session_open(date.fromisoformat(day)), index) for index, day in enumerate(manifest["sessions"])])
        db.execute("CREATE TEMP TABLE expected_symbols(symbol VARCHAR, symbol_index INTEGER)")
        db.executemany("INSERT INTO expected_symbols VALUES (?, ?)",
                       [(item["symbol"], index) for index, item in enumerate(manifest["symbols"])])
        report(0, 4, "checking ticks")
        tick_count, bad_ticks, unique_sequences, sequence_errors = db.execute("""
            SELECT count(*), count(*) FILTER (WHERE price <= 0 OR bid <= 0 OR ask <= bid
              OR price < bid OR price > ask OR bid_size <= 0 OR ask_size <= 0 OR trade_volume <= 0
              OR t < p.session_start OR t >= p.session_start + ? OR (t-p.session_start) % 1 <> 0),
              count(DISTINCT sequence_number), count(*) FILTER (WHERE sequence_number <>
                es.day_index * ? * ? + (t-p.session_start) * ? + sy.symbol_index + 1)
            FROM read_parquet(?) p
            LEFT JOIN expected_sessions es USING (session_start)
            LEFT JOIN expected_symbols sy USING (symbol)
        """, [SESSION_SECONDS, SESSION_SECONDS, len(manifest["symbols"]), len(manifest["symbols"]), ticks]).fetchone()
        report(1, 4, "checking per-session coverage")
        coverage_errors = db.execute("""SELECT abs(?-count(*)) + coalesce(sum(CASE WHEN points<>? OR distinct_points<>? OR first_offset<>0 OR last_offset<>?-1 THEN 1 ELSE 0 END),0)
          FROM (SELECT symbol,session_start,count(*) points,count(DISTINCT t) distinct_points,min(t-session_start) first_offset,max(t-session_start) last_offset
          FROM read_parquet(?) GROUP BY symbol,session_start)""",[len(manifest["sessions"])*len(manifest["symbols"]),SESSION_SECONDS,SESSION_SECONDS,SESSION_SECONDS,ticks]).fetchone()[0]
        report(2, 4, "checking candles")
        candle_count, bad_candles = db.execute("""
            SELECT count(*), count(*) FILTER (WHERE open <= 0 OR low <= 0 OR high < greatest(open,close)
              OR low > least(open,close) OR volume <= 0 OR trade_count <> 60
              OR t < session_start OR t >= session_start + ? OR (t-session_start) % 60 <> 0)
            FROM read_parquet(?)
        """, [SESSION_SECONDS, candles]).fetchone()
        report(3, 4, "matching candles to ticks")
        disagreement = db.execute("""
            WITH actual AS (SELECT symbol, session_start, t-t%60 AS minute,
              first(price ORDER BY t) open_value, max(price) high_value, min(price) low_value, last(price ORDER BY t) close_value,
              sum(trade_volume) volume, count(*) trade_count FROM read_parquet(?) GROUP BY ALL)
            SELECT count(*) FROM actual a FULL JOIN read_parquet(?) c
              ON (a.symbol,a.session_start,a.minute)=(c.symbol,c.session_start,c.t)
            WHERE a.symbol IS NULL OR c.symbol IS NULL OR round(a.open_value,6)<>c.open OR round(a.high_value,6)<>c.high
              OR round(a.low_value,6)<>c.low OR round(a.close_value,6)<>c.close OR a.volume<>c.volume OR a.trade_count<>c.trade_count
        """, [ticks, candles]).fetchone()[0]
    report(4, 4, "archive validated")
    if (tick_count, candle_count) != (expected_ticks, expected_candles) or bad_ticks or bad_candles or unique_sequences != tick_count or sequence_errors or coverage_errors or disagreement:
        raise ValueError(f"Archive validation failed: {tick_count=}, {candle_count=}, {bad_ticks=}, {bad_candles=}, {unique_sequences=}, {sequence_errors=}, {coverage_errors=}, {disagreement=}")
    if manifest.get("fingerprint") != archive_fingerprint(manifest):
        raise ValueError("Manifest fingerprint is invalid")
    return {"ticks": tick_count, "candles": candle_count, "files": len(ticks) + len(candles)}
