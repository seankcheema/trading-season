"""Turn the TradingSeason simulation archive into one daily OHLCV CSV per symbol.

Runs inside the platform's market-data image, which has pyarrow; it does not
import stock_forecast. It reads the generated candles-*.parquet files (one-minute
candles, the same files the platform's candles endpoint serves) and never
touches the trading_season database. From the repository root:

    docker run --rm \\
      -v trading-season-local_market_data_archive:/archive:ro \\
      -v "$PWD/apps/holdings-and-trade-service/stock-forecast:/sf" --entrypoint python \\
      trading-season-local-market-data-seed /sf/scripts/export-platform-daily.py \\
      --archive /archive/synthetic-market-data-2026-v1 --out /sf/data/platform
"""
import argparse
import csv
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--archive", type=Path, required=True, help="folder holding candles-YYYY-MM-DD.parquet")
parser.add_argument("--out", type=Path, required=True, help="folder for <symbol>.csv files")
args = parser.parse_args()

files = sorted(args.archive.glob("candles-*.parquet"))
if not files:
    raise SystemExit(f"No candles-*.parquet files in {args.archive}; has the market data been seeded?")
daily: dict[str, list] = {}
for path in files:
    day = path.stem.removeprefix("candles-")
    table = pq.read_table(path).sort_by([("symbol", "ascending"), ("t", "ascending")])
    for symbol in pc.unique(table["symbol"]).to_pylist():
        minutes = table.filter(pc.equal(table["symbol"], symbol))
        # Daily bar: first open, highest high, lowest low, last close, total volume.
        daily.setdefault(symbol, []).append((
            day, float(minutes["open"][0].as_py()), float(pc.max(minutes["high"]).as_py()),
            float(pc.min(minutes["low"]).as_py()), float(minutes["close"][-1].as_py()),
            int(pc.sum(minutes["volume"]).as_py()), minutes.num_rows))
args.out.mkdir(parents=True, exist_ok=True)
for symbol, rows in daily.items():
    with open(args.out / f"{symbol.lower()}.csv", "w", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")  # Unix endings, as git diff --check expects
        writer.writerow(["Date", "Open", "High", "Low", "Close", "Volume", "minutes"])
        writer.writerows(rows)
    print(f"{symbol}: {len(rows)} days -> {args.out / (symbol.lower() + '.csv')}")
