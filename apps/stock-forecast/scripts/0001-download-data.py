"""Download AAPL and SPY daily prices once and save them to data/.

Run once, commit the CSVs, and never re-download mid-project: every result
must come from the same snapshot. --force replaces existing files.
"""
import argparse
from pathlib import Path

import _bootstrap  # noqa: F401
from stock_forecast import config
from stock_forecast.data import download_prices, save_prices

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--force", action="store_true", help="replace existing CSV files")
args = parser.parse_args()

snapshots = ((config.TICKER, config.PRICES_CSV), (config.MARKET_TICKER, config.MARKET_CSV))
# Check both destinations before any network call, preserving the committed pair.
existing = [Path(path) for _, path in snapshots if Path(path).exists()]
if existing and not args.force:
    paths = ", ".join(str(path) for path in existing)
    parser.error(f"refusing to overwrite existing snapshot(s): {paths}; pass --force to replace them")

for ticker, path in snapshots:
    prices = download_prices(ticker)
    save_prices(prices, path, overwrite=args.force)
    print(f"{ticker}: {len(prices)} rows, {prices.index.min().date()} to {prices.index.max().date()} -> {path}")
