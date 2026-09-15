from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from .common import DEFAULT_CONFIG, DEFAULT_DATASET, SESSION_SECONDS, STOCKS, archive_fingerprint, load_json, session_open, sha256, weekdays
from .validation import load_manifest, validate_archive

TICK_SCHEMA = pa.schema([("symbol", pa.string()), ("t", pa.int64()), ("session_start", pa.int64()),
    ("price", pa.decimal128(18,6)), ("bid", pa.decimal128(18,6)), ("ask", pa.decimal128(18,6)),
    ("bid_size", pa.int32()), ("ask_size", pa.int32()), ("trade_volume", pa.int32()), ("sequence_number", pa.int64())])
CANDLE_SCHEMA = pa.schema([("symbol",pa.string()),("t",pa.int64()),("session_start",pa.int64()),
    ("open",pa.decimal128(18,6)),("high",pa.decimal128(18,6)),("low",pa.decimal128(18,6)),("close",pa.decimal128(18,6)),
    ("volume",pa.int64()),("trade_count",pa.int32())])

def _events(config: dict[str, Any]) -> list[dict[str, Any]]:
    result=[]
    for overlay, entries in ((False,config["schedule"]),(True,config["overlays"])):
        for item in entries:
            params=config["conditions"][item["condition"]]
            result.append(item | {"start_date":item["start"],"end_date_exclusive":item["end"],"start":session_open(date.fromisoformat(item["start"])),"end":session_open(date.fromisoformat(item["end"])),"overlay":overlay,"symbols":[s.symbol for s in STOCKS],"strength":params["strength"]})
    return sorted(result,key=lambda x:x["start"])

def _file_record(path: Path, day: date) -> dict[str, Any]:
    return {"name":path.name,"day":str(day),"bytes":path.stat().st_size,"sha256":sha256(path)}

def generate(root: Path=DEFAULT_DATASET, config_path: Path=DEFAULT_CONFIG, start_date: date|None=None, end_date: date|None=None, regenerate: bool=False) -> dict[str, Any]:
    config=load_json(config_path); year=config["year"]
    start_date=start_date or date(year,1,1); end_date=end_date or date(year,12,31)
    if start_date>end_date or start_date.year!=year or end_date.year!=year: raise ValueError("Date range must be ordered and within the configured year")
    days=weekdays(start_date,end_date)
    if not days: raise ValueError("Date range contains no weekdays")
    if (root/"manifest.json").exists() and not regenerate:
        existing=load_manifest(root)
        if existing["config"]==config and existing["sessions"]==[str(d) for d in days]: return existing
        raise ValueError("Existing archive differs; use --regenerate to replace ticks and candles together")
    staging=root.with_name(f".{root.name}.staging-{uuid.uuid4().hex}"); staging.mkdir(parents=True)
    tick_files=[]; candle_files=[]
    try:
        previous={s.symbol:float(s.starting_price) for s in STOCKS}
        for day_index,day in enumerate(days):
            start=session_open(day); tick_path=staging/f"ticks-{day}.parquet"; candle_path=staging/f"candles-{day}.parquet"
            candle_tables=[]
            with pq.ParquetWriter(tick_path,TICK_SCHEMA,compression="zstd") as writer:
                for index,stock in enumerate(STOCKS):
                    rng=np.random.default_rng(np.random.SeedSequence([config["seed"],day.toordinal(),index]))
                    event=next(e for e in config["schedule"] if e["start"]<=str(day)<e["end"]); params=config["conditions"][event["condition"]]
                    sigma=float(stock.base_volatility)*params["volatility_multiplier"]
                    volume_factor=params["volume_multiplier"]
                    for overlay in config["overlays"]:
                        if overlay["start"]<=str(day)<overlay["end"]:
                            overlay_params=config["conditions"][overlay["condition"]]
                            sigma*=overlay_params["volatility_multiplier"]; volume_factor*=overlay_params["volume_multiplier"]
                    shocks=rng.normal(params["drift"]/(252*SESSION_SECONDS),sigma/np.sqrt(252*SESSION_SECONDS),SESSION_SECONDS)
                    prices=np.round(previous[stock.symbol]*np.exp(np.cumsum(shocks)),6); prices=np.maximum(prices,0.000002); previous[stock.symbol]=float(prices[-1])
                    spread=np.maximum(0.000002,np.round(prices*0.0001,6)); bid=np.round(prices-spread/2,6); ask=np.round(prices+spread/2,6)
                    bid=np.minimum(bid,prices); ask=np.maximum(ask,prices); ask=np.where(ask<=bid,bid+0.000001,ask)
                    volumes=np.maximum(1,rng.poisson((stock.average_volume/SESSION_SECONDS)*volume_factor,SESSION_SECONDS)).astype(np.int32)
                    times=np.arange(start,start+SESSION_SECONDS,dtype=np.int64)
                    sequences=(day_index*SESSION_SECONDS*len(STOCKS))+np.arange(SESSION_SECONDS,dtype=np.int64)*len(STOCKS)+index+1
                    def dec(values): return [Decimal(f"{v:.6f}") for v in values]
                    table=pa.table({"symbol":[stock.symbol]*SESSION_SECONDS,"t":times,"session_start":[start]*SESSION_SECONDS,"price":dec(prices),"bid":dec(bid),"ask":dec(ask),"bid_size":rng.integers(1,5001,SESSION_SECONDS,dtype=np.int32),"ask_size":rng.integers(1,5001,SESSION_SECONDS,dtype=np.int32),"trade_volume":volumes,"sequence_number":sequences},schema=TICK_SCHEMA)
                    writer.write_table(table,row_group_size=60000)
                    p=prices.reshape(390,60); v=volumes.reshape(390,60)
                    candle_tables.append(pa.table({"symbol":[stock.symbol]*390,"t":np.arange(start,start+SESSION_SECONDS,60,dtype=np.int64),"session_start":[start]*390,"open":dec(p[:,0]),"high":dec(p.max(axis=1)),"low":dec(p.min(axis=1)),"close":dec(p[:,-1]),"volume":v.sum(axis=1,dtype=np.int64),"trade_count":np.full(390,60,dtype=np.int32)},schema=CANDLE_SCHEMA))
            pq.write_table(pa.concat_tables(candle_tables),candle_path,compression="zstd",row_group_size=3900)
            tick_files.append(_file_record(tick_path,day)); candle_files.append(_file_record(candle_path,day))
        manifest={"schema_version":2,"dataset_id":"2026-v1","seed":config["seed"],"config":config,"start":session_open(days[0]),"end":session_open(days[-1])+SESSION_SECONDS,"sessions":[str(d) for d in days],"symbols":[{"symbol":s.symbol,"name":s.company_name} for s in STOCKS],"events":_events(config),"resolution":{"ticks":"1s","candles":"1m","timezone":"America/Chicago","session":"08:30:00-14:59:59","calendar":"weekdays including holidays"},"tick_files":tick_files,"candle_files":candle_files,"tick_count":len(days)*SESSION_SECONDS*len(STOCKS),"candle_count":len(days)*390*len(STOCKS)}
        manifest["fingerprint"]=archive_fingerprint(manifest); (staging/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
        validate_archive(staging,manifest)
        backup=root.with_name(f".{root.name}.backup-{uuid.uuid4().hex}")
        if root.exists(): os.replace(root,backup)
        try: os.replace(staging,root)
        except BaseException:
            if backup.exists(): os.replace(backup,root)
            raise
        if backup.exists(): shutil.rmtree(backup)
        return manifest
    except BaseException:
        shutil.rmtree(staging,ignore_errors=True)
        raise
