"""Download AAPL and SPY daily prices once and save them to data/.

Run once, commit the CSVs, and never re-download mid-project: every result
must come from the same snapshot. --force replaces existing files. --extra
downloads the EXTRA_SYMBOLS snapshots for compare-symbols.py instead: only
the ones not yet saved, so adding a stock never re-downloads the others. --vix downloads the VIX index snapshot.
"""
import argparse
from pathlib import Path

import _bootstrap  # noqa: F401
from stock_forecast import config
from stock_forecast.data import download_prices, save_prices

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--force", action="store_true", help="replace existing CSV files")
group = parser.add_mutually_exclusive_group()
group.add_argument("--extra", action="store_true", help="download EXTRA_SYMBOLS instead of AAPL and SPY")
group.add_argument("--vix", action="store_true", help="download the VIX index instead of AAPL and SPY")
args = parser.parse_args()

if args.vix:
    snapshots = ((config.VIX_TICKER, config.VIX_CSV),)
elif args.extra:
    snapshots = tuple((symbol, config.SYMBOL_CSVS[symbol]) for symbol in config.EXTRA_SYMBOLS)
else:
    snapshots = ((config.TICKER, config.PRICES_CSV), (config.MARKET_TICKER, config.MARKET_CSV))
if args.extra and not args.force:
    # Adding a stock to EXTRA_SYMBOLS downloads only that stock; saved snapshots stay untouched.
    for ticker, path in snapshots:
        if Path(path).exists():
            print(f"{ticker}: kept existing {path}")
    snapshots = tuple((ticker, path) for ticker, path in snapshots if not Path(path).exists())
# Check every destination before any network call, preserving the committed snapshots.
existing = [Path(path) for _, path in snapshots if Path(path).exists()]
if existing and not args.force:
    paths = ", ".join(str(path) for path in existing)
    parser.error(f"refusing to overwrite existing snapshot(s): {paths}; pass --force to replace them")

for ticker, path in snapshots:
    prices = download_prices(ticker)
    save_prices(prices, path, overwrite=args.force)
    print(f"{ticker}: {len(prices)} rows, {prices.index.min().date()} to {prices.index.max().date()} -> {path}")
