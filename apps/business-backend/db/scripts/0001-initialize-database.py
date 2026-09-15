"""Apply V001 and V002 to an explicitly disposable business database."""
import argparse, asyncio
from pathlib import Path
import asyncpg
async def run(url: str) -> None:
    migrations=Path(__file__).parents[1]/"migrations"; connection=await asyncpg.connect(url)
    try:
        for name in ("V001__Initial_schema.sql","V002__Synthetic_market_data_replay_metadata.sql"):
            await connection.execute((migrations/name).read_text(encoding="utf-8"))
    finally: await connection.close()
if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--database-url",required=True); parser.add_argument("--disposable-database",action="store_true"); args=parser.parse_args()
    if not args.disposable_database: parser.error("--disposable-database is required because V001 drops existing tables")
    asyncio.run(run(args.database_url))
