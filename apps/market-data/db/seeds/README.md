# Database seed datasets

Do not commit generated archives. `synthetic-market-data-2026-v1/` remains ignored and contains the single consolidated dataset identity.

A full archive has `manifest.json`, 261 compressed daily tick partitions, 261 compressed daily candle partitions, 61,074,000 ticks, and 1,017,900 candles for the ten configured symbols. Every weekday is included, including holidays; sessions run from 08:30:00 through 14:59:59 America/Chicago.

Follow the [numbered script workflow](../scripts/README.md). An existing candle-only archive is recognized but cannot be reused: pass `--regenerate` to replace ticks and matching candles atomically. Date ranges are intended for tests and benchmarks.

## Interactive archive viewer

The tracked [2026 market-data notebook](view-synthetic-market-data-2026-v1.ipynb) reads the ignored archive directly with DuckDB. It does not require PostgreSQL and does not load the full dataset into memory. Set one stock and one month in the first code cell; the notebook reads only that month's candle partitions and displays a 15-minute candlestick chart, volume, and a daily summary.

Use the existing virtual environment at `apps/market-data/db/.venv`. If the notebook reports that `duckdb` or another package is missing, it is using the global Python kernel instead of this environment.

From the repository root, install the notebook dependencies and register the virtual environment as a notebook kernel:

```powershell
apps/market-data/db/.venv/Scripts/python.exe -m pip install -r apps/market-data/db/scripts/requirements.txt
apps/market-data/db/.venv/Scripts/python.exe -m ipykernel install --user --name trading-season-market-data --display-name "Python (trading-season market data)"
```

Open the notebook in VS Code, choose `Select Kernel > Python Environments`, and select `apps\market-data\db\.venv\Scripts\python.exe`. Change `SELECTED_SYMBOL` and `SELECTED_MONTH` in the first code cell, then run all cells. The default view shows AAPL for January. If the archive is absent, generate it with the numbered workflow before opening the notebook.

Do not select a virtual environment from another repository. If a traceback points to a path such as `Github\FMS\.venv`, change the kernel back to the `trading-season` environment and restart it. Plotly also requires `nbformat`, which is included in the requirements above.

To confirm that the notebook is using the correct environment, run:

```python
import sys
print(sys.executable)
```

The path should end with `apps\market-data\db\.venv\Scripts\python.exe`.
