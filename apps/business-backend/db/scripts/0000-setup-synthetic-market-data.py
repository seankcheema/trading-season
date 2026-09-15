"""Generate, validate, and import synthetic market data with visible progress."""
import argparse
import asyncio
from datetime import date
from pathlib import Path

from lib.common import DEFAULT_CONFIG, DEFAULT_DATASET, DEFAULT_SESSION_ID
from lib.generation import generate
from lib.importing import import_archive
from lib.progress import Progress
from lib.validation import validate_archive


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--database-url", required=True)
parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
parser.add_argument("--session-id", type=int, default=DEFAULT_SESSION_ID)
parser.add_argument("--start-date", type=date.fromisoformat)
parser.add_argument("--end-date", type=date.fromisoformat)
parser.add_argument("--regenerate", action="store_true")
parser.add_argument("--replace", action="store_true")
args = parser.parse_args()

print("Step 1/3: generating archive (existing compatible archives are reused)")
manifest = generate(args.dataset, args.config, args.start_date, args.end_date, args.regenerate, Progress().update)
print(f"Step 2/3: validating {manifest['tick_count']:,} ticks and {manifest['candle_count']:,} candles")
counts = validate_archive(args.dataset, manifest, Progress().update)
print("Step 3/3: importing into PostgreSQL")
result = asyncio.run(import_archive(args.database_url, args.dataset, args.session_id, args.replace,
                                    Progress().update, counts))
action = "Skipped identical" if result["skipped"] else "Imported"
print(f"{action} archive: {result['ticks']:,} ticks, {result['candles']:,} candles, session_id={result['session_id']}")
