from __future__ import annotations
import json
from pathlib import Path
from typing import Any
import asyncpg
import duckdb
from .common import DEFAULT_SESSION_ID, STOCKS
from .validation import load_manifest, validate_archive

async def _copy(connection: asyncpg.Connection, dataset: Path, files: list[dict[str, Any]], table: str, columns: list[str]) -> None:
    with duckdb.connect(config={"threads": 2}) as db:
        for item in files:
            cursor=db.execute(f"SELECT {','.join(columns)} FROM read_parquet(?) ORDER BY t,symbol", [str(dataset/item["name"])])
            while rows := cursor.fetchmany(25_000):
                await connection.copy_records_to_table(table, records=rows, columns=columns)

async def import_archive(database_url: str, dataset: Path, session_id: int=DEFAULT_SESSION_ID, replace: bool=False) -> dict[str, Any]:
    manifest=load_manifest(dataset); counts=validate_archive(dataset,manifest); fingerprint=manifest["fingerprint"]
    connection=await asyncpg.connect(database_url)
    try:
        async with connection.transaction():
            existing=await connection.fetchrow("SELECT status,config FROM simulation_sessions WHERE id=$1 FOR UPDATE",session_id)
            old_config=existing["config"] if existing else None
            if isinstance(old_config,str): old_config=json.loads(old_config)
            old_fingerprint=(old_config or {}).get("archive_fingerprint")
            if existing and existing["status"]=="COMPLETED" and old_fingerprint==fingerprint:
                return counts | {"session_id":session_id,"skipped":True}
            if existing and not replace:
                raise ValueError("Session has different or candle-only contents; pass --replace to replace only this session")
            if existing: await connection.execute("DELETE FROM simulation_sessions WHERE id=$1",session_id)
            await connection.executemany("""INSERT INTO stocks(symbol,company_name,starting_price,sector,average_volume,base_volatility)
              VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(symbol) DO UPDATE SET company_name=excluded.company_name,
              starting_price=excluded.starting_price,sector=excluded.sector,average_volume=excluded.average_volume,base_volatility=excluded.base_volatility""",
              [(s.symbol,s.company_name,s.starting_price,s.sector,s.average_volume,s.base_volatility) for s in STOCKS])
            config=manifest["config"] | {"dataset_id":manifest["dataset_id"],"archive_fingerprint":fingerprint}
            await connection.execute("""INSERT INTO simulation_sessions(id,seed,drift,config,config_version,status,started_at,ended_at)
              VALUES($1,$2,$3,$4::jsonb,1,'COMPLETED',to_timestamp($5),to_timestamp($6))""",session_id,manifest["seed"],manifest["config"]["conditions"]["normal"]["drift"],json.dumps(config),manifest["start"],manifest["end"])
            await connection.execute("SELECT setval(pg_get_serial_sequence('simulation_sessions','id'),GREATEST((SELECT max(id) FROM simulation_sessions),$1))",session_id)
            await connection.execute("""CREATE TEMP TABLE import_ticks(symbol text,t bigint,price numeric(18,6),bid numeric(18,6),ask numeric(18,6),bid_size integer,ask_size integer,trade_volume integer,sequence_number bigint) ON COMMIT DROP;
              CREATE TEMP TABLE import_candles(symbol text,t bigint,open numeric(18,6),high numeric(18,6),low numeric(18,6),close numeric(18,6),volume bigint,trade_count integer) ON COMMIT DROP""")
            tick_cols=["symbol","t","price","bid","ask","bid_size","ask_size","trade_volume","sequence_number"]
            candle_cols=["symbol","t","open","high","low","close","volume","trade_count"]
            await _copy(connection,dataset,manifest["tick_files"],"import_ticks",tick_cols)
            await _copy(connection,dataset,manifest["candle_files"],"import_candles",candle_cols)
            await connection.execute("""INSERT INTO market_ticks(session_id,symbol,"timestamp",price,bid,ask,bid_size,ask_size,trade_volume,sequence_number)
              SELECT $1,symbol,to_timestamp(t),price,bid,ask,bid_size,ask_size,trade_volume,sequence_number FROM import_ticks ORDER BY t,symbol""",session_id)
            await connection.execute("""INSERT INTO candles(session_id,symbol,"interval","timestamp",open,high,low,close,volume,trade_count)
              SELECT $1,symbol,'1m',to_timestamp(t),open,high,low,close,volume,trade_count FROM import_candles ORDER BY t,symbol""",session_id)
            behaviors=[(session_id,symbol,e["condition"],e["start"],float(e["end"]-e["start"]),e["strength"]) for e in manifest["events"] for symbol in e["symbols"]]
            await connection.executemany("INSERT INTO market_behaviors(session_id,symbol,behavior_type,start_time,duration_seconds,strength) VALUES($1,$2,$3,to_timestamp($4),$5,$6)",behaviors)
            await connection.executemany("INSERT INTO market_states(session_id,symbol,trend,volatility,liquidity,momentum) VALUES($1,$2,'uptrend',$3,0.5,0)",[(session_id,s.symbol,s.base_volatility) for s in STOCKS])
        return counts | {"session_id":session_id,"skipped":False}
    finally: await connection.close()
