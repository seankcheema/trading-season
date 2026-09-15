"""Validate and transactionally import the 2026-v1 archive into PostgreSQL."""
import argparse, asyncio
from pathlib import Path
from lib.common import DEFAULT_DATASET, DEFAULT_SESSION_ID
from lib.importing import import_archive
from lib.progress import Progress
parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--database-url",required=True); parser.add_argument("--dataset",type=Path,default=DEFAULT_DATASET); parser.add_argument("--session-id",type=int,default=DEFAULT_SESSION_ID); parser.add_argument("--replace",action="store_true"); args=parser.parse_args()
result=asyncio.run(import_archive(args.database_url,args.dataset,args.session_id,args.replace,Progress().update)); action="Skipped identical" if result["skipped"] else "Imported"
print(f"{action} archive: {result['ticks']:,} ticks, {result['candles']:,} candles, session_id={result['session_id']}")
