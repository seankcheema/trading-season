"""Validate and transactionally import the 2026-v1 archive into PostgreSQL."""
import argparse, asyncio
from pathlib import Path
from lib.common import DEFAULT_DATASET, DEFAULT_SESSION_ID
from lib.importing import import_archive
from lib.progress import Progress
parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--database-url",required=True); parser.add_argument("--dataset",type=Path,default=DEFAULT_DATASET); parser.add_argument("--session-id",type=int,default=DEFAULT_SESSION_ID); parser.add_argument("--replace",action="store_true"); parser.add_argument("--available-disk-gb",type=float,help="Free space on the PostgreSQL server when its data directory is not locally accessible."); parser.add_argument("--tick-storage",choices=("parquet","postgres"),default="parquet"); args=parser.parse_args()
result=asyncio.run(import_archive(args.database_url,args.dataset,args.session_id,args.replace,Progress().update,available_disk_gb=args.available_disk_gb,tick_storage=args.tick_storage)); action="Skipped identical" if result["skipped"] else "Imported"
print(f"{action} archive: {result['archived_ticks']:,} archived ticks, {result['database_ticks']:,} database ticks, {result['candles']:,} candles, {result['completed_months']} monthly checkpoints, session_id={result['session_id']}")
