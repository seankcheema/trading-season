"""Validate the 2026-v1 archive without database access."""
import argparse
from pathlib import Path
from lib.common import DEFAULT_DATASET
from lib.validation import validate_archive
parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--dataset",type=Path,default=DEFAULT_DATASET); args=parser.parse_args()
result=validate_archive(args.dataset); print(f"Validated {result['ticks']:,} ticks and {result['candles']:,} candles in {result['files']} files")
