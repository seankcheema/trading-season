import asyncio
import json
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

import asyncpg
import pytest

SCRIPTS=Path(__file__).parents[1]/"scripts"
sys.path.insert(0,str(SCRIPTS))
from lib.generation import generate
from lib.importing import import_archive

DATABASE_URL=os.getenv("TEST_DATABASE_URL")
AVAILABLE_DISK_GB=float(os.getenv("MARKET_DATA_AVAILABLE_DISK_GB","1"))


@pytest.mark.skipif(not DATABASE_URL,reason="TEST_DATABASE_URL is required")
def test_parquet_month_failure_commits_prior_month_and_resume_skips_it():
    asyncio.run(_exercise_parquet_monthly_resume())


@pytest.mark.skipif(not DATABASE_URL,reason="TEST_DATABASE_URL is required")
def test_bounded_postgres_tick_mode():
    asyncio.run(_exercise_postgres_tick_mode())


async def _exercise_parquet_monthly_resume():
    session_id=2026999
    unrelated_id=2026998
    connection=await asyncpg.connect(DATABASE_URL)
    try:
        await connection.execute("DELETE FROM simulation_sessions WHERE id=ANY($1::bigint[])",[session_id,unrelated_id])
        await connection.execute("INSERT INTO simulation_sessions(id,seed,drift,config,started_at) VALUES($1,1,0,'{}',now())",unrelated_id)
    finally:
        await connection.close()
    try:
        with tempfile.TemporaryDirectory() as directory:
            dataset=Path(directory)/"archive"
            generate(dataset,start_date=date(2026,1,30),end_date=date(2026,2,2))
            with pytest.raises(RuntimeError,match="2026-02"):
                await import_archive(DATABASE_URL,dataset,session_id,available_disk_gb=AVAILABLE_DISK_GB,fail_after_month="2026-02")
            connection=await asyncpg.connect(DATABASE_URL)
            try:
                january=await connection.fetchval("SELECT count(*) FROM candles WHERE session_id=$1 AND \"timestamp\"<'2026-02-01'",session_id)
                database_ticks=await connection.fetchval("SELECT count(*) FROM market_ticks WHERE session_id=$1",session_id)
                february=await connection.fetchval("SELECT count(*) FROM candles WHERE session_id=$1 AND \"timestamp\">='2026-02-01'",session_id)
                status=await connection.fetchval("SELECT status FROM simulation_sessions WHERE id=$1",session_id)
                assert january==3900
                assert database_ticks==0
                assert february==0
                assert status=="RUNNING"
            finally:
                await connection.close()
            result=await import_archive(DATABASE_URL,dataset,session_id,available_disk_gb=AVAILABLE_DISK_GB)
            assert result["completed_months"]==2
            repeated=await import_archive(DATABASE_URL,dataset,session_id,available_disk_gb=AVAILABLE_DISK_GB)
            assert repeated["skipped"] is True
            connection=await asyncpg.connect(DATABASE_URL)
            try:
                row=await connection.fetchrow("SELECT status,(SELECT count(*) FROM market_ticks WHERE session_id=$1) ticks,(SELECT count(*) FROM candles WHERE session_id=$1) candles FROM simulation_sessions WHERE id=$1",session_id)
                assert (row["status"],row["ticks"],row["candles"])==("COMPLETED",0,7800)
                config=await connection.fetchval("SELECT config FROM simulation_sessions WHERE id=$1",session_id)
                if isinstance(config,str): config=json.loads(config)
                assert config["tick_storage"]["mode"]=="parquet"
                assert config["tick_storage"]["archived_ticks"]==468000
                assert config["tick_storage"]["database_ticks"]==0
                assert await connection.fetchval("SELECT count(*) FROM simulation_sessions WHERE id=$1",unrelated_id)==1
                config["import_checkpoint"]["completed_months"]["2026-01"]["fingerprint"]="tampered"
                await connection.execute("UPDATE simulation_sessions SET status='RUNNING',config=$2::jsonb WHERE id=$1",session_id,json.dumps(config))
            finally:
                await connection.close()
            with pytest.raises(ValueError,match="checkpoint"):
                await import_archive(DATABASE_URL,dataset,session_id,available_disk_gb=AVAILABLE_DISK_GB)
            replaced=await import_archive(DATABASE_URL,dataset,session_id,replace=True,available_disk_gb=AVAILABLE_DISK_GB)
            assert replaced["completed_months"]==2
            connection=await asyncpg.connect(DATABASE_URL)
            try:
                assert await connection.fetchval("SELECT count(*) FROM simulation_sessions WHERE id=$1",unrelated_id)==1
            finally:
                await connection.close()
    finally:
        connection=await asyncpg.connect(DATABASE_URL)
        try: await connection.execute("DELETE FROM simulation_sessions WHERE id=ANY($1::bigint[])",[session_id,unrelated_id])
        finally: await connection.close()


async def _exercise_postgres_tick_mode():
    session_id=2026997
    try:
        with tempfile.TemporaryDirectory() as directory:
            dataset=Path(directory)/"archive"
            generate(dataset,start_date=date(2026,1,5),end_date=date(2026,1,5))
            result=await import_archive(DATABASE_URL,dataset,session_id,available_disk_gb=AVAILABLE_DISK_GB,tick_storage="postgres")
            assert result["database_ticks"]==234000
            connection=await asyncpg.connect(DATABASE_URL)
            try:
                row=await connection.fetchrow("SELECT (SELECT count(*) FROM market_ticks WHERE session_id=$1) ticks,(SELECT count(*) FROM candles WHERE session_id=$1) candles",session_id)
                assert (row["ticks"],row["candles"])==(234000,3900)
            finally:
                await connection.close()
    finally:
        connection=await asyncpg.connect(DATABASE_URL)
        try: await connection.execute("DELETE FROM simulation_sessions WHERE id=$1",session_id)
        finally: await connection.close()
