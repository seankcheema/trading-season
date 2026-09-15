"""Generate deterministic 2026-v1 tick and candle Parquet partitions."""
import argparse
from datetime import date
from pathlib import Path
from lib.common import DEFAULT_CONFIG, DEFAULT_DATASET
from lib.generation import generate
from lib.progress import Progress
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output",type=Path,default=DEFAULT_DATASET); parser.add_argument("--config",type=Path,default=DEFAULT_CONFIG)
parser.add_argument("--start-date",type=date.fromisoformat); parser.add_argument("--end-date",type=date.fromisoformat); parser.add_argument("--regenerate",action="store_true")
args=parser.parse_args(); result=generate(args.output,args.config,args.start_date,args.end_date,args.regenerate,Progress().update)
print(f"Published {result['tick_count']:,} ticks and {result['candle_count']:,} candles to {args.output}")
