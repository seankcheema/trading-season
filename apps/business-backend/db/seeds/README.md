# Database seed datasets

This directory keeps lightweight seed metadata and instructions. Do not commit large generated market-data archives here.

## Synthetic market data 2026-v1 archive

`synthetic-market-data-2026-v1/` is intentionally ignored by Git. It contains the locally generated synthetic market data archive when you want to import one year of generated minute candles into the business database.

Expected contents:

- `manifest.json`
- 261 daily Parquet files
- dataset id: `2026-v1`
- candles: `1,017,900`
- symbols: `AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `META`, `TSLA`, `JPM`, `XOM`, `UNH`

Set up the script virtual environment once from the repository root:

```powershell
py -3 -m venv apps/business-backend/db/.venv
apps/business-backend/db/.venv/Scripts/python.exe -m pip install --upgrade pip
apps/business-backend/db/.venv/Scripts/python.exe -m pip install -r apps/business-backend/db/scripts/requirements.txt
```

```powershell
apps/business-backend/db/scripts/apply-synthetic-market-data.ps1 `
  -Python apps/business-backend/db/.venv/Scripts/python.exe
```

To run only the local generator:

```powershell
apps/business-backend/db/.venv/Scripts/python.exe apps/business-backend/db/scripts/generate-synthetic-market-data.py `
  --output apps/business-backend/db/seeds/synthetic-market-data-2026-v1
```
